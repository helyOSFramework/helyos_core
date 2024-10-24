/* This Source Code is subject to the terms of a modified Apache License Version 2.0.
** If a copy of the license was not distributed with this file, You can obtain one at http://github.com/helyosframework/helyos_core/. 
** Copyright 2022,  Fraunhofer-Institut für Verkehrs- und Infrastruktursysteme IVI.
*/

const { logData } = require("../../modules/systemlog");
const { setDBTimeout } = require("../database/database_services");

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
    constructor(longTimeout=3000, shortTimeout=500, limitWaitingFlushes=10) {
        if (InMemDB.instance) {
            return InMemDB.instance;
        }
        
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

    }


    /**
     * Inserts data into the specified table.
     * @param {string} tableName - The name of the table.
     * @param {Object} data - The data to be inserted.
     * @param {DatabaseService} dbService - The database service instance.
     * @returns {Promise} A promise that resolves with the inserted data.
     */
    insert(tableName, indexName, data) {
        return this[tableName][data[indexName]] = data;
    }


    /**
     * Updates data in the specified table based on the provided timestamp.
     * @param {string} tableName - The name of the table.
     * @param {string} indexName - The name of the table index.
     * @param {Object} data - The updated data.
     * @param {number} timeStamp - The timestamp of the updated data.
     * @returns {Promise} A promise that resolves with a status code.
     */
    update(tableName,indexName, data, storeTimeStamp, statsLabel='buffered', msgTimeStamp=0) {
        if (!msgTimeStamp) msgTimeStamp = storeTimeStamp;
        const table = this[tableName];
        const tableStats = this[`${tableName}_stats`];
        let instance = table[data[indexName]];
        let statsData = tableStats[data[indexName]];

        // Create Instance
        if (!instance) { 
            table[data[indexName]] = {};
            instance = table[data[indexName]];
            instance['last_message_time'] = 0;
        }

        // Create Stats
        if (!statsData ){
            tableStats[data[indexName]] = { msgPerSecond: new UpdateStats(),
                                            updtPerSecond: new UpdateStats(), 
                                            errorPerSecond: new UpdateStats(10)
                                           };
            statsData = tableStats[data[indexName]];
        }

        // Update Instance if the message is newer
        if ((storeTimeStamp - msgTimeStamp) < MAX_DELAY || statsLabel === 'realtime' ){ 
            Object.assign(instance, data);
            data.id = instance.id;
            instance['last_message_time'] = storeTimeStamp;
            this.updateBuffer(tableName,indexName, data, storeTimeStamp);
            return true;
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
    delete(tableName, indexName, dataId) {
        const tableStatsName = `${tableName}_stats`;
        const tableBufferName = `${tableName}_buffer`;
        delete this[tableName][dataId];
        delete this[tableStatsName][dataId];
        delete this[tableBufferName][dataId];
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


        // Damaging control: if the number of pending promisses is too big, reduce the update timeout and accept the losts.
        try {
            await this._dynamicallyChooseTimeout();
        } catch (error) {
            console.error(error);
        }


        this.lastFlushTime = new Date();
        const objArray = Object.keys(this[tableBufferName])
                            .map(key => { 
                                const msgPerSecond = this[tableStatsName][key]['msgPerSecond'].countsPerSecond;
                                this[tableName][key].msg_per_sec = msgPerSecond;
                                this[tableBufferName][key].msg_per_sec = msgPerSecond;

                                this[tableStatsName][key].updtPerSecond.countMessage();
                                const updtPerSecond = this[tableStatsName][key].updtPerSecond.countsPerSecond;
                                this[tableName][key]['updt_per_sec'] = updtPerSecond;
                                this[tableBufferName][key]['updt_per_sec'] = updtPerSecond;
                                if (tableName !== 'agents') {
                                    delete this[tableName][key]['last_message_time'];
                                    delete this[tableBufferName][key]['updt_per_sec'];
                                    delete this[tableBufferName][key]['msg_per_sec'];
                                    delete this[tableBufferName][key]['_leaderAgents'];
                                }
                                return this[tableBufferName][key];
                            });

        this[tableBufferName] = {};   

        if ( objArray.length === 0 ) return Promise.resolve(null);
        
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
     updateBuffer(tableName,index, data, timeStamp) {
        const tableBufferName = `${tableName}_buffer`;
        const tableBuffer = this[tableBufferName];
        let instance = tableBuffer[data[index]];

        // Create Instance
        if (!instance) {
            tableBuffer[data[index]] = {};
            instance = tableBuffer[data[index]];
            instance['last_message_time'] = 0;
        }
        // Update Instance
        Object.assign(instance, data);
        instance['last_message_time'] = timeStamp;
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

    constructor(inMemDB, dbServices, tableName, requiredFields, reloadPeriod = 0) {
        this.dbServices = dbServices;
        this.inMemDB = inMemDB;
        this.requiredFields = [...requiredFields];
        if(this.requiredFields.indexOf('modified_at') === -1) this.requiredFields.push('modified_at');
        this.reloadPeriod = reloadPeriod;
        this.tableName = tableName;
    }

    getData(index, indexName='uuid', reload=false) {
        if (this.startTimePerId[index] === undefined) {this.startTimePerId[index] = new Date();}
        const startTime = this.startTimePerId[index];
        if (!this.reloadPeriod) {return this.getDataFromSource(index, indexName, reload); }

        if ((new Date() - startTime) > this.reloadPeriod || reload) {  
            this.startTimePerId[index] = new Date();
            return this.inMemDB.flush(this.tableName,indexName, this.dbServices[this.tableName], 0)
                   .then( () => this.getDataFromSource(index, indexName, true));
        } 
        return this.getDataFromSource(index, indexName, false);
    }

    getDataFromSource(index, indexName='uuid', reload=false) {
        const inMemAgentData = this.inMemDB[this.tableName][index] || {};
        if (!reload && this.requiredFields.every(field => inMemAgentData[field] !== undefined)) {
            return inMemAgentData;
        }
        return this.dbServices[this.tableName].get(indexName, index, this.requiredFields)
                .then((r) => { 
                    if(r.length) {
                        this.inMemDB.update(this.tableName,indexName,r[0],new Date(), 'realtime');
                        return r[0];
                    } else return null;
                });
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
let inMemDB = new InMemDB(LONG_TIMEOUT,SHORT_TIMEOUT, MAX_PENDING_UPDATES);
async function getInstance() {
  if (!inMemDB) {
    console.log('====> Creating In Memory Database Service instance')

    inMemDB = new InMemDB(LONG_TIMEOUT,SHORT_TIMEOUT, MAX_PENDING_UPDATES);
    console.log('====> In Memory Database Service created')
  }
  return inMemDB;
}

module.exports.inMemDB = inMemDB;
module.exports.DataRetriever = DataRetriever;
module.exports.getInstance = getInstance;