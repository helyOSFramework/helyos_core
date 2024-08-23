/* This Source Code is subject to the terms of a modified Apache License Version 2.0.
** If a copy of the license was not distributed with this file, You can obtain one at http://github.com/helyosframework/helyos_core/. 
** Copyright 2022,  Fraunhofer-Institut für Verkehrs- und Infrastruktursysteme IVI.
*/

const { logData } = require("../../modules/systemlog");
const { setDBTimeout } = require("../database/database_services");
const redisAccessLayer = require('./redis_access_layer');

const DB_BUFFER_TIME = parseInt(process.env.DB_BUFFER_TIME || 1000);
const LONG_TIMEOUT = 2000; // Maximum time for the database update

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
    constructor(connectedClients, longTimeout=3000, shortTimeout=500, limitWaitingFlushes=10) {
        if (InMemDB.instance) {
            return InMemDB.instance;
        }

        this.client =  connectedClients[0];
        this.subClient =  connectedClients[1];
        this.agents = {};
        this.agents_stats = {};
        this.map_objects_stats = {};

        this.getAsync = (key) => redisAccessLayer.getValue(this.subClient,key);
        this.setAsync = (key, value) => redisAccessLayer.setValue(this.client, key, value);
        this.delAsync = (key) => redisAccessLayer.deleteKey(this.client, key);
        this.msetAsync = (keyValuePairs) => redisAccessLayer.setManyValues(this.client, {...keyValuePairs});
        this.atomicGetDelete = (key) => redisAccessLayer.getAndDeleteKey(this.client, key);

        this.hGetFieldAsync = (hash, field) => redisAccessLayer.hGet(this.subClient, hash, field);
        this.hGetAsync = (hash, field) => redisAccessLayer.hGetAll(this.subClient, hash);
        this.hSetAsync = (hash,object) => redisAccessLayer.hSet(this.client, hash, object);
        this.hDelAsync = (hash,field) => redisAccessLayer.deleteKey(this.client, hash, field);
        this.hashDelAsync = (hash) => redisAccessLayer.deleteHash(this.client, hash);
        this.atomicHGetDelete = (hash) => redisAccessLayer.getAndDeleteHash(this.client, hash);
        this.getHashesByPattern = (pattern) => redisAccessLayer.getHashesByPattern(this.subClient, pattern);
        this.getAndDeleteHashesByPattern = (pattern) => redisAccessLayer.getAndDeleteHashesByPattern(this.client, pattern);

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
    async insert(tableName, indexName, data) {
        await this.hSetAsync(`${tableName}:${data[indexName]}`, data);
        return data;
    }

    /**
     * Updates data in the specified table based on the provided timestamp.
     * @param {string} tableName - The name of the table.
     * @param {string} indexName - The name of the table index.
     * @param {Object} data - The updated data.
     * @param {number} timeStamp - The timestamp of the updated data.
     * @param {string} mode - If update should be "buffered" or "realtime".
     * @param {Object} dbService - The database service object. Required if mode is "realtime".
     * @returns {Promise} A promise that resolves with a status code.
     */
    async update(tableName, indexName, data, timeStamp, mode = 'buffered', dbService=null) {
        if (!data) return false;
        const keyId = data[indexName];
        const entityHash = `${tableName}:${keyId}`;
        const tableStats = `${tableName}_stats`;
        const statHash = `${tableStats}:${keyId}`;
        data['last_message_time'] = timeStamp;

        if (mode === 'realtime') {
            await Promise.all(  [this.hSetAsync(entityHash, data),
                                 dbService.update(indexName, keyId, data)
                                ]);
        } else {
            await this.hSetAsync(entityHash, data);
        }

        let statsData = this[tableStats][keyId];

        // Create Stats
        if (!statsData ){
            this[tableStats][keyId] = { msgPerSecond: new UpdateStats(),
                                        updtPerSecond: new UpdateStats(), 
                                        errorPerSecond: new UpdateStats(10)
                                        };
        }
        
        if (mode == 'buffered') {
            await this.updateBuffer(tableName, indexName, data, timeStamp);
        }

        // Immediately save in database:

        // const patchStat = {}
        // patchStat[keyId] = statsData
        // await this.hSetAsync(tableStats,patchStat);

        // // Update Instance if the message is newer
        // if (instance.last_message_time < timeStamp || statsLabel === 'realtime') {
        //     Object.assign(instance, data);
        //     data.id = instance.id;
        //     instance.last_message_time = timeStamp;
        //     const patch = {}
        //     patch[keyId] = instance
        //     await this.hSetAsync(tableName, patch);
        //     await this.updateBuffer(tableName, indexName, data, timeStamp);
        //     return true;
        // }

        return true;
    }

    /**
     * Deletes data from the specified table.
     * @param {string} table - The name of the table.
     * @param {string} dataId - The ID of the data to be deleted.
     * @param {Object} dbService - The database service object.
     * @returns {Promise} A promise that resolves with a status code.
     */
    async delete(tableName, indexName, dataId) {
        const keyId = dataId;
        const entityHash = `${tableName}:${keyId}`;
        const entityHashBuffer = `${tableName}_buffer:${keyId}`;
        await this.hashDelAsync(entityHash);
        await this.hashDelAsync(entityHashBuffer);
    }

    /**
     * Flushes the specified table to the database.
     * @param {string} table - The name of the table to be flushed.
     * @param {string} indexName - The name of the table index.
     * @param {Object} dbService - The database service object.
     * @param {number} maxAge - The maximum age of data to be flushed (optional, defaults to 0).
     * @returns {Promise} A promise that resolves after the flush operation completes.
     */
    async flush(tableName, indexName, dbService, maxAge = 0) {
        const now = new Date();
        const tableBufferName = `${tableName}_buffer`;
        const tableStatsName = `${tableName}_stats`;
        const useShortTimeOutClient = maxAge > 0;

        this._dynamicallyChooseTimeout();

        if (!maxAge && (now - this.lastFlushTime) < maxAge) {
            return Promise.resolve();
        }
        // console.log('start flush.......')
        this.lastFlushTime = new Date();
        const objectsToSave = await this.getAndDeleteHashesByPattern(`${tableBufferName}:*`);
        if (!objectsToSave) return;


        const tableStatsData = this[tableStatsName];
        const objArray = Object.keys(objectsToSave)
                    .map(key => { 
                        const keyId = objectsToSave[key][indexName]
                        if (tableStatsData[keyId]) {
                            const msgPerSecond = tableStatsData[keyId]['msgPerSecond'].countsPerSecond;
                            tableStatsData[keyId]['updtPerSecond'].countMessage();
                            const updtPerSecond = tableStatsData[keyId]['updtPerSecond'].countsPerSecond;

                            objectsToSave[key].msg_per_sec = msgPerSecond;
                            objectsToSave[key].updt_per_sec = updtPerSecond;


                            if (tableName !== 'agents') {
                                delete objectsToSave[key]['last_message_time'];
                                delete objectsToSave[key]['_leaderAgents'];
                            }
                            this.hSetAsync(`${tableName}:${keyId}`, {msg_per_sec: msgPerSecond, updt_per_sec: updtPerSecond});

                        }
                        
                        return objectsToSave[key];
                    });

 

        const promiseTrigger = () => dbService.updateMany(objArray, indexName, useShortTimeOutClient)
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
    async updateBuffer(tableName, indexName, data, timeStamp) {
        const keyId = data[indexName];
        const tableBuffer = `${tableName}_buffer`;
        const entityHash = `${tableBuffer}:${keyId}`;
        data['last_message_time'] = timeStamp;
        await this.hSetAsync(entityHash, data);
    }

    dispatchUpdatePromise(promiseTrigger, numberUpdates = 1) {
        if (this.pendingPromises > 2 * this.limitWaitingFlushes) {
            this.lostUpdates += numberUpdates;
            return Promise.resolve();
        }
        this.pendingPromises++;

        return promiseTrigger()
            .finally(() => this.pendingPromises--);
    }

    async getHistoricalCountRateAverage(tableName, index, minSample = 10) {
        const key = `${tableName}_stats:${index}`;
        let avgMsgPerSecond = 0;
        let avgUpdtPerSecond = 0;

        const stats = await this.getAsync(key);
        if (!stats) {
            return { avgMsgPerSecond, avgUpdtPerSecond };
        }

        const parsedStats = JSON.parse(stats);
        const msgPerSecondH = parsedStats.msgPerSecond.countsPerSecondHistory;
        if (msgPerSecondH.length >= minSample) {
            const sum = parsedStats.msgPerSecond.countsPerSecondMovingAcumm;
            avgMsgPerSecond = (sum / msgPerSecondH.length);
        }

        const updtPerSecondH = parsedStats.updtPerSecond.countsPerSecondHistory;
        if (updtPerSecondH.length >= minSample) {
            const sum = parsedStats.updtPerSecond.countsPerSecondMovingAcumm;
            avgUpdtPerSecond = (sum / updtPerSecondH.length);
        }
        return { avgMsgPerSecond, avgUpdtPerSecond };
    }

    _catch_update_errors(n = 1) {
        if (this.lostUpdates === 0) {
            this.timeoutCounterStartTime = new Date();
        }

        this.lostUpdates += n;

        if (new Date() - this.timeoutCounterStartTime > 10000) {
            if (this.updateTimeout === this.shortTimeout || this.lostUpdates > 5)                 
                logData.addLog('helyos_core', null, 'warn', `Too many updates pushed to the database. The timeout was reduced to ${this.shortTimeout} milliseconds to avoid the system blockage.`);
                logData.addLog('helyos_core', null, 'error',
             `${this.lostUpdates} database updates canceled. Pending promises:${this.pendingPromises}. Timeout: ${this.updateTimeout/1000} secs. Try to increase the buffer time, DB_BUFFER_TIME.`);
            this.lostUpdates = 0;
            this.timeoutCounterStartTime = new Date();
        }
    }


    _dynamicallyChooseTimeout() {
        if (this.pendingPromises > this.limitWaitingFlushes) {
            if (this.updateTimeout === this.longTimeout) {
                this.updateTimeout = this.shortTimeout;
                setDBTimeout(this.updateTimeout);
            }
        }

        if (this.pendingPromises < Math.round(this.limitWaitingFlushes / 2)) {
            if (this.updateTimeout === this.shortTimeout) {
                this.updateTimeout = this.longTimeout;
                setDBTimeout(this.updateTimeout);
            }
        }
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
 * @param {InMemDB} inMemDB - The in-memory database object.
 * @param {DatabaseService} dbTableService - The database service object.
 * @param {string} tableName - The name of the database table.
 * @param {Array} requiredFields - The required fields for the database query.
 * @param {number} reloadPeriod - The period (in seconds) after which the data is reloaded from the database.
 * @returns {Promise} A promise that resolves with the agent data.
 **/
class DataRetriever {
    startTimePerId = {};

    constructor(inMemDB, dbServices, tableName, requiredFields, reloadPeriod = 0) {
        this.dbServices = dbServices;
        this.inMemDB = inMemDB;
        this.requiredFields = [...requiredFields];
        if (this.requiredFields.indexOf('modified_at') === -1) this.requiredFields.push('modified_at');
        this.reloadPeriod = reloadPeriod;
        this.tableName = tableName;
    }

    async getData(index, indexName = 'uuid', reload = false) {
        if (this.startTimePerId[index] === undefined) {
            this.startTimePerId[index] = new Date();
        }
        const startTime = this.startTimePerId[index];
        if (!this.reloadPeriod) {
            return this.getDataFromSource(index, indexName, reload);
        }

        if ((new Date() - startTime) > this.reloadPeriod || reload) {
            this.startTimePerId[index] = new Date();
            // await this.inMemDB.flush(this.tableName, indexName, this.dbServices[this.tableName], 0);
            return this.getDataFromSource(index, indexName, true);
        }
        return this.getDataFromSource(index, indexName, false);
    }

    async getDataFromSource(index, indexName = 'uuid', reload = false) {
        const key = `${this.tableName}:${index}`;
        const inMemAgentData = await this.inMemDB.hGetAsync(key).then(data => data || {});

        if (!reload && this.requiredFields.every(field => inMemAgentData[field] !== undefined)) {
            return inMemAgentData;
        }

        const result = await this.dbServices[this.tableName].get(indexName, index, this.requiredFields);
        if (result.length) {
            await this.inMemDB.update(this.tableName, indexName, result[0], new Date(), 'realtime', this.dbServices[this.tableName]);
            return result[0];
        } else {
            return null;
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
    await redisAccessLayer.ensureConnected();
    const redisClients = [redisAccessLayer.subClient, redisAccessLayer.pubClient]
    inMemDB = new InMemDB(redisClients, LONG_TIMEOUT,SHORT_TIMEOUT, MAX_PENDING_UPDATES);
    console.log('====> In Memory Database Service created')
  }
  return inMemDB;
}

module.exports.getInstance = getInstance;
module.exports.DataRetriever = DataRetriever;