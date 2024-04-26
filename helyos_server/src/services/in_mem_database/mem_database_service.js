/* This Source Code is subject to the terms of a modified Apache License Version 2.0.
** If a copy of the license was not distributed with this file, You can obtain one at http://github.com/helyosframework/helyos_core/. 
** Copyright 2022,  Fraunhofer-Institut für Verkehrs- und Infrastruktursysteme IVI.
*/

const { logData } = require("../../modules/systemlog");

/**
 * In-memory database class for storing and manipulating data.
 */
class InMemDB {
    lastFlushTime = new Date();
    lostUpdates = 0;
    timeoutCounterStartTime = null;
    limitFlushSize = 1000; // System is blocked; all updates will be destroyed.
    longTimeout = 3000;
    shortTimeout = 500; //  Chosen to be smaller than the set desired update period.
    limitFlushSizeForLongTimeout = 20;
    penddingPromises = 0;

    constructor() {
        this.agents = {};
        this.map_objects = {};
        this.agents_buffer = {};
        this.map_objects_buffer = {};
        this.agents_stats = {};
        this.map_objects_stats = {};
        this.updateTimeout = this.longTimeout;
    }

    /**
     * Inserts data into the specified table.
     * @param {string} tableName - The name of the table.
     * @param {Object} data - The data to be inserted.
     * @param {DatabaseService} dbService - The database service instance.
     * @returns {Promise} A promise that resolves with the inserted data.
     */
    insert(tableName, index, data) {
        return this[table][r[index]] = data;
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


    /**
     * Updates data in the specified table based on the provided timestamp.
     * @param {string} tableName - The name of the table.
     * @param {Object} data - The updated data.
     * @param {number} timeStamp - The timestamp of the updated data.
     * @returns {Promise} A promise that resolves with a status code.
     */
    update(tableName,index, data, timeStamp, statsLabel='buffered') {
        const table = this[tableName];
        const tableStats = this[`${tableName}_stats`];
        let instance = table[data[index]];
        let statsData = tableStats[data[index]];

        // Create Instances
        if (!instance) { 
            table[data[index]] = {};
            instance = table[data[index]];
            instance['last_message_time'] = 0;
        }

        if (!statsData ){
            tableStats[data[index]]={'msgPerSecond': new UpdateStats(), 'updtPerSecond': new UpdateStats(), 'errorPerSecond': new UpdateStats(10)};
            statsData = tableStats[data[index]];
        }


        if (instance['last_message_time'] < timeStamp || statsLabel === 'realtime'){ 
            Object.assign(instance, data);
            instance['last_message_time'] = timeStamp;
            this.updateBuffer(tableName,index, data, timeStamp);
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
    delete(tableName, index, dataId) {
        const tableStatsName = `${tableName}_stats`;
        const tableBufferName = `${tableName}_buffer`;
        delete this[tableName][dataId];
        delete this[tableStatsName][dataId];
        delete this[tableBufferName][dataId];
    }

    _timeoutWrapper(promise) {
            return Promise.race([
              promise,
              new Promise((_, reject) =>
                setTimeout(() => {
                    reject(new Error("Promise timeout"))
                }, this.updateTimeout)
              ),
            ]);
    }


    _catch_update_errors(e) {
        this.lostUpdates += 1;
        if (this.lostUpdates === 1) {
            this.timeoutCounterStartTime = new Date();
        }
        if (new Date() - this.timeoutCounterStartTime > 10000) {
            logData.addLog('helyos_core', null, 'error', `${e.message}: ${this.lostUpdates} updates in the last 10 seconds. Pending updates:${this.penddingPromises}. timeout: ${this.updateTimeout/1000} secs`);
            this.lostUpdates = 0;
            this.timeoutCounterStartTime = new Date();
        }
    }

    dispatchUpdatePromise(promiseTrigger) {
        this.penddingPromises++;
        return promiseTrigger()
               .catch( e => {
                this._catch_update_errors(e);
                })
                .finally(() => {
                            this.penddingPromises--;
                });

    }

    _dynamicallyChooseTimeout() {
        if (this.penddingPromises > (this.limitFlushSizeForLongTimeout + 1)){
            if (this.updateTimeout === this.longTimeout) {
                logData.addLog('helyos_core', null, 'warn', `Reduce update timeout.`);
                this.updateTimeout = this.shortTimeout;
            }
        } 
        
        if (this.penddingPromises < (this.limitFlushSizeForLongTimeout - 1)){
            if (this.updateTimeout === this.shortTimeout) {
                logData.addLog('helyos_core', null, 'warn', `Increase update timeout.`);
                this.updateTimeout = this.longTimeout;
            }
        }
    }

    /**
     * Flushes the specified table to the database.
     * @param {string} table - The name of the table to be flushed.
     * @param {Object} dbService - The database service object.
     * @param {number} maxAge - The maximum age of data to be flushed (optional, defaults to 0).
     * @returns {Promise} A promise that resolves after the flush operation completes.
     */
    flush(tableName, index, dbService, maxAge = 0){
        const now = new Date();
        const tableBufferName = `${tableName}_buffer`;
        const tableStatsName = `${tableName}_stats`;


        // Damaging control: if the number of pending promisses is too big, reduce the update timeout and accept the losts.
        this._dynamicallyChooseTimeout();

        if ((now - this.lastFlushTime) < maxAge) { 
            return Promise.resolve();
        }
        
        this.lastFlushTime = new Date();
        const objArray = Object.keys(this[tableBufferName])
                            .map(key => { 
                                const msgPerSecond = this[tableStatsName][key]['msgPerSecond'].countsPerSecond;
                                this[tableName][key]['msg_per_sec'] = msgPerSecond;
                                this[tableBufferName][key]['msg_per_sec'] = msgPerSecond;

                                this[tableStatsName][key]['updtPerSecond'].countMessage();
                                const updtPerSecond = this[tableStatsName][key]['updtPerSecond'].countsPerSecond;
                                this[tableName][key]['updt_per_sec'] = updtPerSecond;
                                this[tableBufferName][key]['updt_per_sec'] = updtPerSecond;
                                if (tableName !== 'agents') {
                                    delete this[tableName][key]['last_message_time'];
                                    delete this[tableBufferName][key]['_leaderAgents'];
                                }
                                return this[tableBufferName][key];
                            });

        this[tableBufferName] = {};   
        
        const promiseTrigger = () => this._timeoutWrapper(dbService.updateMany(objArray, index)) 
                                    .then((r) => {
                                        r.forEach(e => { 
                                            if (e.failedIndex) {
                                                // delete this[tableName][e.failedIndex];
                                                logData.addLog('helyos_core', null, 'error', `Database updated: ${tableName} ${e.failedIndex}`);
                                        }})
                                    });
            

        return this.dispatchUpdatePromise(promiseTrigger);                            
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
const inMemDB = new InMemDB();

module.exports.inMemDB = inMemDB;
module.exports.DataRetriever = DataRetriever;