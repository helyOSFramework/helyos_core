/* This Source Code is subject to the terms of a modified Apache License Version 2.0.
** If a copy of the license was not distributed with this file, You can obtain one at http://github.com/helyosframework/helyos_core/. 
** Copyright 2022,  Fraunhofer-Institut für Verkehrs- und Infrastruktursysteme IVI.
*/

const { logData } = require("../../modules/systemlog");
const { setDBTimeout } = require("../database/database_services");
const redisAccessLayer = require('./redis_access_layer');
const REDIS_HOST = redisAccessLayer.REDIS_HOST;

const DB_BUFFER_TIME = parseInt(process.env.DB_BUFFER_TIME || 1000);
const LONG_TIMEOUT = 2000; // Maximum time for the database update
const MAX_DELAY = 100;

let MAX_PENDING_UPDATES = LONG_TIMEOUT / DB_BUFFER_TIME;
MAX_PENDING_UPDATES = MAX_PENDING_UPDATES > 5 ? MAX_PENDING_UPDATES : 5;
const SHORT_TIMEOUT = DB_BUFFER_TIME / 2;


/**
 * In-memory database class for storing and manipulating data.
 * This class is used to store and manipulate data in memory.
 * 
 *  The input parameters are:
 * - longTimeout: The long timeout period (in milliseconds) for the database update.
 * - shortTimeout: The short timeout period (in milliseconds) for the database update.
 * - limitWaitingFlushes: The upper limit for the number of pending updates that triggers the long timeout.
 * 
 * shortTimeout and longTimeout are used to dynamically adjust the update timeout (this.updateTimeout) based on the number of pending promisses updates. 
 * 
 * If the number of pending promisses is higher than MAX_PENDING_UPDATES, the update timeout is reduced to shortTimeout. 
 * If the number of pending promisses keeps increasing to higher then 2 x MAX_PENDING_UPDATES, the system will additionally block new updates.
 * The smaller timeout causes the the database update promises to expire which will reduce the number of pending promisses, decresing the system load.
 * Therefore, we are accepting to lose some updates in order to avoid the system to be blocked.
 * 
 * If the number of pending promisses is small, the update timeout is increased to longTimeout.
 * 
 * 
 */
class InMemDB {
/**
 * Constructor for the InMemDB class.
 * 
 * @param {number} longTimeout - The long timeout period (in milliseconds) for the database update.
 * @param {number} shortTimeout - The short timeout period (in milliseconds) for the database update.
 * @param {number} limitWaitingFlushes - The upper limit for the number of pending updates that triggers the long timeout.
 * 
 * @returns {InMemDB} An instance of the InMemDB class.
 * 
 */
    constructor(connectedRedisClients,longTimeout=3000, shortTimeout=500, limitWaitingFlushes=10) {
        if (InMemDB.instance) {
            return InMemDB.instance;
        }
        
        this.client =  connectedRedisClients['publisher'];
        this.subClient =  connectedRedisClients['subscriber'];

        this.agents = {};
        this.agents_buffer = {};
        this.agents_stats = {};
        this.map_objects = {};
        this.map_objects_buffer = {};
        this.map_objects_stats = {};

        this.longTimeout = longTimeout;
        this.shortTimeout = shortTimeout;
        this.limitWaitingFlushes = limitWaitingFlushes;
        this.pendingPromises = 0;
        this.lostUpdates = 0;

        this.timeoutCounterStartTime = null;
        this.updateTimeout = this.longTimeout;
        this.lastFlushTime = new Date();
        InMemDB.instance = this;    
        
        if (REDIS_HOST) {
            this.hSetAsync = (hash,object) => redisAccessLayer.hSet(this.client, hash, object);
            this.hashDelAsync = (hash) => redisAccessLayer.deleteHash(this.client, hash);
            this.getHashesByPattern = (pattern) => redisAccessLayer.getHashesByPattern(this.client, pattern);
            this.getAndDeleteHashesByPattern = (pattern) => redisAccessLayer.getAndDeleteHashesByPattern(this.client, pattern);
            this.hGetAsync = (hash, field) => redisAccessLayer.hGetAll(this.subClient, hash);      
        }

    }


    async get(tableName,  indexValue, indexName='') {
        if (REDIS_HOST) {
            const key = `${tableName}:${indexValue}`;
            return await this.hGetAsync(key).then(data => data || null);
        }
        return this[tableName][indexValue] || null;
    }

    async list(tableName,  conditions={}) {
        if (REDIS_HOST) {
            const filter = `${tableName}:*`;
            return await this.getHashesByPattern(filter);
        }
        return this[tableName] || null;
    }


    /**
     * Inserts data into the specified table.
     * @param {string} tableName - The name of the table.
     * @param {Object} data - The data to be inserted.
     * @param {DatabaseService} dbService - The database service instance.
     * @returns {Promise} A promise that resolves with the inserted data.
     */
    async insert(tableName, indexName, data) {
        const keyId = data[indexName];
        if (REDIS_HOST) {
            await this.hSetAsync(`${tableName}:${keyId}`, data);
        } else {
            this[tableName][keyId] = data;
        }
        return data;
    }


    /**
     * Updates data in the specified table based on the provided timestamp.
     * @param {string} tableName - The name of the table.
     * @param {string} indexName - The name of the table index.
     * @param {Object} data - The updated data.
     * @param {number} timeStamp - The timestamp of the updated data.
     * @returns {Promise} A promise that resolves with a status code.
     */
    async update(tableName,indexName, data, storeTimeStamp, mode='buffered', msgTimeStamp=0,  dbService=null) {
        if (!msgTimeStamp) msgTimeStamp = storeTimeStamp;
        const keyId = data[indexName];
        const table = this[tableName];
        const tableStats = this[`${tableName}_stats`];

        // Initialize local inMem register
        table[keyId] = table[keyId]?  table[keyId]:{'last_message_time':storeTimeStamp};
        Object.assign(table[keyId], data);

        // Instance local statistics
        if (!tableStats[keyId] ){
            tableStats[keyId] = {   msgPerSecond: new UpdateStats(),
                                    updtPerSecond: new UpdateStats(), 
                                    errorPerSecond: new UpdateStats(10)
                                };          
        }



        if (REDIS_HOST) {
            const entityHash = `${tableName}:${keyId}`;
            if (mode === 'realtime') {
                tableStats[keyId].updtPerSecond.countMessage();
                await Promise.all(  [this.hSetAsync(entityHash, data),
                                     dbService.update(indexName, keyId, data) //Loop?
                                    ]);
            }         
            if (mode == 'buffered') {
                await this.hSetAsync(entityHash, data);
                await this.updateBuffer(tableName, indexName, data, msgTimeStamp);
            }

            return true;
        }

        if (!REDIS_HOST) {
            data.id = table[keyId].id;

            if (mode === 'realtime') {
                tableStats[keyId].updtPerSecond.countMessage();
                this.updateBuffer(tableName,indexName, data, storeTimeStamp);
                await dbService.update(indexName, keyId, data); // Loop?
                return true;
            }
            if (mode == 'buffered') {
                if ((storeTimeStamp - msgTimeStamp) < MAX_DELAY) {
                    this.updateBuffer(tableName,indexName, data, storeTimeStamp);
                    return true
                }
                return false;
            }

        }



        return false;
    }


    /**
     * Deletes data from the specified table.
     * @param {string} table - The name of the table.
     * @param {string} dataId - The ID of the data to be deleted.
     * @param {Object} dbService - The database service object.
     * @returns {Promise} A promise that resolves with a status code.
     */
    async delete(tableName, indexName, dataId) {
        const tableStatsName = `${tableName}_stats`;
        delete this[tableName][dataId];
        delete this[tableStatsName][dataId];

        if (REDIS_HOST) {
            const keyId = dataId;
            const entityHash = `${tableName}:${keyId}`;
            const entityHashBuffer = `${tableName}_buffer:${keyId}`;
            await this.hashDelAsync(entityHash);
            await this.hashDelAsync(entityHashBuffer);
        }

        if (!REDIS_HOST) {
            const tableBufferName = `${tableName}_buffer`;
            delete this[tableBufferName][dataId];
        }

    }


    /**
     * Flushes the specified table to the database.
     * @param {string} table - The name of the table to be flushed.
     * @param {string} indexName - The name of the table index.
     * @param {Object} dbService - The database service object.
     * @param {number} maxAge - The maximum age of data to be flushed (optional, defaults to 0).
     * @returns {Promise} A promise that resolves after the flush operation completes.
     */
    async flush(tableName, indexName, dbService, maxAge = 0){
        const now = new Date();
        const tableBufferName = `${tableName}_buffer`;
        const tableStatsName = `${tableName}_stats`;
        const useShortTimeOutClient = true;


        // Damaging control: if there are too many pending update promisses, reduce the timeout and accept the losses.
        try {
            await this._dynamicallyChooseTimeout();
        } catch (error) {
            console.error(error);
        }

        // Get buffered data
        let bufferedData = {};
        if (REDIS_HOST){
            bufferedData = await this.getAndDeleteHashesByPattern(`${tableBufferName}:*`);
        } else {
            bufferedData = {...this[tableBufferName]}; //Get &
            this[tableBufferName] = {};                //Delete
        }
        // Nothing to do if buffer is empty
        if (Object.keys(bufferedData).length === 0) { return null };


        this.lastFlushTime = new Date();
  
        const objArray = Object.keys(bufferedData) // Objects to be updated in the postgres database
                        .map(key => { 
                            // Save statistic counts:
                            let statKey = key.split(':');
                            statKey = statKey.length > 1 ? statKey[1] : key;
                            if (this[tableStatsName][statKey]){
                                this[tableStatsName][statKey].updtPerSecond.countMessage();
                                const msgPerSecond = this[tableStatsName][statKey].msgPerSecond.countsPerSecond;
                                const updtPerSecond = this[tableStatsName][statKey].updtPerSecond.countsPerSecond;
                                // this[tableName][key].msg_per_sec = msgPerSecond;
                                bufferedData[key].msg_per_sec = msgPerSecond;
                                bufferedData[key].updt_per_sec = updtPerSecond;
                                if (REDIS_HOST) { // COMMENT: WIP - check alternative
                                    // this.hSetAsync(`${tableName}:${keyId}`, {msg_per_sec: msgPerSecond, updt_per_sec: updtPerSecond});
                                }     
                            }

                            // Delete properties that are relevant only for agents:
                            if (tableName !== 'agents') {
                                // delete this[tableName][key]['last_message_time'];
                                delete bufferedData[key]['updt_per_sec'];
                                delete bufferedData[key]['msg_per_sec'];
                                delete bufferedData[key]['_leaderAgents'];
                            }
                            return bufferedData[key];
                            });

        
        const promiseTrigger = () =>    dbService.updateMany(objArray, indexName, useShortTimeOutClient)
                                        .then((r) => {
                                            if (r && r.length) {     
                                                const failedDataTypeError = r.filter(e => e && e.error && e.error.message.includes('constraint'));
                                                const failedIndexes = r.filter(e => e && e.error && !e.error.message.includes('constraint'));

                                                failedDataTypeError.forEach(e => {
                                                    logData.addLog('helyos_core', {uuid: e.failedIndex}, 'error',`Update failed on ${tableName} / ${e.failedIndex} ${e.error.message}` );
                                                    console.log(e.error.message);
                                                });

                                                if (failedIndexes.length) {
                                                    this._catch_update_errors(failedIndexes.length);
                                                    failedIndexes.forEach(e => {
                                                        console.log(`Update failed on ${tableName} / ${e.failedIndex}`);
                                                        // delete this[tableName][e.failedIndex];
                                                    });
                                                }
                                            }
                                        })
                                        .catch(e => {
                                            logData.addLog('helyos_core', null, 'error', `Database update timeout error: ${e.message}`);
                                        });


        return this.dispatchUpdatePromise(promiseTrigger, objArray.length);                            
    }


     /**
     * Updates data in the specified table based on the provided timestamp.
     * @param {string} tableName - The name of the table.
     * @param {Object} data - The updated data.
     * @param {number} timeStamp - The timestamp of the updated data.
     * @returns {Promise} A promise that resolves with a status code.
     */
     async updateBuffer(tableName,indexName, data, timeStamp) {
        const keyId = data[indexName];
        const tableBufferName = `${tableName}_buffer`;
        const tableBuffer = this[tableBufferName];
        const entityBufferHash = `${tableBufferName}:${keyId}`;
        data['last_message_time'] = timeStamp;

        if(REDIS_HOST){
            await this.hSetAsync(entityBufferHash, data);
        }

        if (!REDIS_HOST){
            if (tableBuffer[keyId]){
                Object.assign(tableBuffer[keyId], data);
            } else { 
                tableBuffer[keyId]= data; 
            }
        }

    }


   
    dispatchUpdatePromise(promiseTrigger, numberUpdates=1) {
        // Damaging control: if the number of pending promisses is too big, block new updates and accept the losts.
        if (this.pendingPromises > 2 * this.limitWaitingFlushes) {
            this.lostUpdates += numberUpdates;
            return Promise.resolve();
        }
        this.pendingPromises++;

        return promiseTrigger()
                .finally(() => this.pendingPromises-- );

    }


    getHistoricalCountRateAverage(tableName, index, minSample=10){
        const tableStatsName = `${tableName}_stats`;
        let avgMsgPerSecond = 0; let avgUpdtPerSecond=0;
        
        if (!this[tableStatsName] || !this[tableStatsName][index] || !this[tableStatsName][index]['updtPerSecond'])  {
            return {avgMsgPerSecond, avgUpdtPerSecond};
        }

        const msgPerSecondH = this[tableStatsName][index]['msgPerSecond'].countsPerSecondHistory;
        if (msgPerSecondH.length >= minSample){
            const sum = this[tableStatsName][index]['msgPerSecond'].countsPerSecondMovingAcumm;
            avgMsgPerSecond = (sum / msgPerSecondH.length);
        }

        const updtPerSecondH = this[tableStatsName][index]['updtPerSecond'].countsPerSecondHistory;
        if (updtPerSecondH.length >= minSample){
            const sum = this[tableStatsName][index]['updtPerSecond'].countsPerSecondMovingAcumm;
            avgUpdtPerSecond = (sum / updtPerSecondH.length);
        }
        return {avgMsgPerSecond, avgUpdtPerSecond};
    }


    _catch_update_errors(n=1) {
        if (this.lostUpdates === 0) {
            this.timeoutCounterStartTime = new Date();
        }

        this.lostUpdates += n;

        if (new Date() - this.timeoutCounterStartTime > 10000) {
            if (this.updateTimeout === this.shortTimeout || this.lostUpdates > 5)                 
                logData.addLog('helyos_core', null, 'warn', `Too many updates pushed to the database. The timeout was reduced to ${this.shortTimeout} milliseconds to avoid the system blockage.`);
                logData.addLog('helyos_core', null, 'error',
             `${this.lostUpdates} database updates canceled. Pending promises:${this.pendingPromises}. Timeout: ${this.updateTimeout/1000} secs. Try to increase the buffer time, DB_BUFFER_TIME.`);
            console.warn( `${this.lostUpdates} database updates canceled. Pending promises:${this.pendingPromises}. Timeout: ${this.updateTimeout/1000} secs. Try to increase the buffer time, DB_BUFFER_TIME.`)
            this.lostUpdates = 0;
            this.timeoutCounterStartTime = new Date();
        }
    }


   async _dynamicallyChooseTimeout() {
        if (this.pendingPromises > this.limitWaitingFlushes){
            if (this.updateTimeout === this.longTimeout) {
                this.updateTimeout = this.shortTimeout;
                return setDBTimeout(this.updateTimeout);
            }
        } 
        
        if (this.pendingPromises < Math.round(this.limitWaitingFlushes/2)){
            if (this.updateTimeout === this.shortTimeout) {
                this.updateTimeout = this.longTimeout;
                return setDBTimeout(this.updateTimeout);
            }
        }
        return null;
    }

}

/**
 * Agent data retriever class.
 * This class is used to retrieve agent data.
 * - If the data is already in the in-memory database, it is returned.
 * - If the data is not in the in-memory database, it is retrieved from the database.
 * - If the last database reloading is older than {reloadPeriod} seconds, the data is reloaded from the database.
 * - If the data is not in the database, null is returned.
 * 
 * 
 * @param {InMemDB} inMemDB - The in-memory database object.
 * @param {DatabaseService} dbTableService - The database service object.
 * @param {string} tableName - The name of the database table.
 * @param {Array} requiredFields - The required fields for the database query.
 * @param {number} reloadPeriod - The period (in seconds) after which the data is reloaded from the database.
 * @returns {Promise} A promise that resolves with the agent data.
 **/
class DataRetriever {
    startTimePerId = {}
    static instance = null;

    constructor(inMemDB, dbServices, tableName, requiredFields, reloadPeriod = 1000) {
        this.dbServices = dbServices;
        this.inMemDB = inMemDB;
        this.requiredFields = [...requiredFields];
        if(this.requiredFields.indexOf('modified_at') === -1) this.requiredFields.push('modified_at');
        this.reloadPeriod = reloadPeriod;
        this.tableName = tableName;
        DataRetriever.instance = this;
    }

    static getInstance(inMemDB, dbServices, tableName, requiredFields, reloadPeriod = 1000) {
        if (!DataRetriever.instance) {
            DataRetriever.instance = new DataRetriever(inMemDB, dbServices, tableName, requiredFields, reloadPeriod);
        }
        return DataRetriever.instance;
    }


    getData(index, indexName='uuid', reload=false) {
        // console.log(this.startTimePerId[index])

        if (this.startTimePerId[index] === undefined) {this.startTimePerId[index] = new Date();}
        // console.log("now", this.startTimePerId[index])

        const deltaTime = (new Date() - this.startTimePerId[index])
        let _reload = null;
        if (deltaTime > this.reloadPeriod/2 ) { _reload = "IN_MEM"};
        if (deltaTime > this.reloadPeriod ) { _reload = "POSTGRES"};

        if (_reload === "IN_MEM") {
            this.startTimePerId[index] = new Date();
        }
        if (_reload === "POSTGRES") {
            this.startTimePerId[index] = new Date();
        }

        return this.getDataFromSelectedSource(index, indexName, _reload);
    }

    async getDataFromSelectedSource(index, indexName='uuid', reload=null) {
        let _reload = reload;

        if (_reload === null) {
            const inMemLocalData = this.inMemDB.agents[index];
            if (inMemLocalData && this.requiredFields.every(field => inMemLocalData[field] !== undefined)) {
                // console.log("return local \n", (new Date() -  this.startTimePerId[index] ) )
                return inMemLocalData;
            } else {
                _reload = "IN_MEM";
            }
        }

        if (_reload === "IN_MEM" ) {
            const inMemServerData =  await this.inMemDB.get(this.tableName, index) || {};
            if (inMemServerData && this.requiredFields.every(field => inMemServerData[field] !== undefined)) {
                // console.log("return server \n")
                return inMemServerData;
            } else {
                _reload = "POSTGRES";
            }
        }

        if (_reload === "POSTGRES" ) {
            console.log("return database \n",  (new Date() -  this.startTimePerId[index] ));
    
            return this.dbServices[this.tableName].get(indexName, index, this.requiredFields)
                    .then((r) => { 
                        if(r.length) {
                            this.inMemDB.update(this.tableName,indexName,r[0],new Date(), 'realtime',0 , this.dbServices[this.tableName] );
                            return r[0];
                        } else return null;
                    });
        }


    }



}


// Helper class for calculating the average count rate.
class UpdateStats {
    counts = 0;
    startCountingTime = new Date();
    countsPerSecond = 0;
    enlapsed_time = 0;
    minSample = 100;
    historyLength = 50;
    countsPerSecondHistory = [];
    countsPerSecondMovingAcumm = 0;

    constructor(minSample = 100) {
        this.minSample = minSample; 
    }

    countMessage(){
        this.counts += 1;
        if (this.counts === 1){
            this.startCountingTime = new Date();
        }
        if (this.counts === this.minSample){
            const now = new Date();
            this.enlapsed_time = (now - this.startCountingTime)/1000;
            this.countsPerSecond = this.counts/this.enlapsed_time;
            this.countsPerSecondHistory.push(this.countsPerSecond);
            this.countsPerSecondMovingAcumm = this.countsPerSecondMovingAcumm + this.countsPerSecond;
            if (this.countsPerSecondHistory.length > this.historyLength){
                this.countsPerSecondHistory.shift();
                this.countsPerSecondMovingAcumm = this.countsPerSecondMovingAcumm - this.countsPerSecondHistory[0];
            }
            this.counts = 0;
        }
    }
}



// Singleton instance of the in-memory database.
let inMemDB;
async function getInstance() {
  if (!inMemDB) {
    console.log('====> Creating In Memory Database Service instance')

    let redisClients;
    if (REDIS_HOST) { 
        await redisAccessLayer.ensureConnected(); 
        redisClients = {'subscriber': redisAccessLayer.subClient, 'publisher':redisAccessLayer.pubClient};
    } else {
        redisClients = {'subscriber': null, 'publisher':null};
    }
    inMemDB = new InMemDB(redisClients, LONG_TIMEOUT,SHORT_TIMEOUT, MAX_PENDING_UPDATES);

    console.log('====> In Memory Database Service created')
  }
  return inMemDB;
}

module.exports.inMemDB = inMemDB;
module.exports.DataRetriever = DataRetriever;
module.exports.getInstance = getInstance;