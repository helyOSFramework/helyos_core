/* This Source Code is subject to the terms of a modified Apache License Version 2.0.
** If a copy of the license was not distributed with this file, You can obtain one at http://github.com/helyosframework/helyos_core/.
** Copyright 2022,  Fraunhofer-Institut für Verkehrs- und Infrastruktursysteme IVI.
*/

const {
    logData,
} = require("../../modules/systemlog");
import databaseService from "../database/database_services";
import {AgentDataLayer, DatabaseLayer} from "../database/database_services";

import * as redisAccessLayer from './redis_access_layer';
import config from '../../config';

const {
    setDBTimeout,
} = databaseService;
const {
    REDIS_HOST, DB_BUFFER_TIME,
} = config;

const LONG_TIMEOUT = 2000; // Maximum time for the database update
const MAX_DELAY = 100;
const STAT_ACCUM_PERIOD = 10000; // Set accummlation time to calculate msg rates.

let MAX_PENDING_UPDATES = LONG_TIMEOUT / DB_BUFFER_TIME;
MAX_PENDING_UPDATES = MAX_PENDING_UPDATES > 5 ? MAX_PENDING_UPDATES : 5;
const SHORT_TIMEOUT = DB_BUFFER_TIME / 2;

interface RedisClients {
    subscriber: redisAccessLayer.RedisClient;
    publisher: redisAccessLayer.RedisClient;
}

interface DatabaseService extends AgentDataLayer {}

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
    static instance: InMemDB | null = null;
    client: any;
    subClient: any;
    startTime: Date;
    agents: Record<string, any>;
    agents_buffer: Record<string, any>;
    agents_stats: Record<string, any>;
    map_objects: Record<string, any>;
    map_objects_buffer: Record<string, any>;
    map_objects_stats: Record<string, any>;
    longTimeout: number;
    shortTimeout: number;
    limitWaitingFlushes: number;
    pendingPromises: number;
    lostUpdates: number;
    timeoutCounterStartTime: Date;
    updateTimeout: number;
    lastFlushTime: Date;
    hSetAsync: (hash: string, object: any) => Promise<any>;
    hashDelAsync: (hash: string) => Promise<any>;
    getHashesByPattern: (pattern: string) => Promise<Record<string, any>>;
    getAndDeleteHashesByPattern: (pattern: string) => Promise<Record<string, any>>;
    hGetAsync: (hash: string) => Promise<Record<string, any>>;
    hIncrBy: (hash: string, field: string, increment: number) => Promise<any>;

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
    constructor(connectedRedisClients: RedisClients, longTimeout = 3000, shortTimeout = 500, limitWaitingFlushes = 10) {
        if (InMemDB.instance) {
            return InMemDB.instance;
        }

        this.client = connectedRedisClients['publisher'];
        this.subClient = connectedRedisClients['subscriber'];
        this.startTime = new Date();

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

        this.timeoutCounterStartTime = new Date();
        this.updateTimeout = this.longTimeout;
        this.lastFlushTime = new Date();
        InMemDB.instance = this;

        if (REDIS_HOST) {
            this.hSetAsync = (hash, object) => redisAccessLayer.hSet(this.client, hash, object);
            this.hashDelAsync = (hash) => redisAccessLayer.deleteHash(this.client, hash);
            this.getHashesByPattern = (pattern) => redisAccessLayer.getHashesByPattern(this.client, pattern);
            this.getAndDeleteHashesByPattern = (pattern) => redisAccessLayer.getAndDeleteHashesByPattern(this.client, pattern);
            this.hGetAsync = (hash) => redisAccessLayer.hGetAll(this.subClient, hash);
            this.hIncrBy = (hash, field, increment) => redisAccessLayer.hIncrBy(this.subClient, hash, field, increment);
        }

    }

    async get(tableName: string, indexValue: string, indexName = ''): Promise<any> {
        if (REDIS_HOST) {
            const key = `${tableName}:${indexValue}`;
            return await this.hGetAsync(key).then(data => data || null);
        }
        return this[tableName][indexValue] || null;
    }

    async list(tableName: string, conditions = {}): Promise<any> {
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
    async insert(tableName: string, indexName: string, data: any): Promise<any> {
        const keyId = data[indexName];
        if (REDIS_HOST) {
            await this.hSetAsync(`${tableName}:${keyId}`, data);
        } else {
            this[tableName][keyId] = data;
        }
        return data;
    }

    async countMessages(tableStatsName: string, keyId: string, counter: string): Promise<void> {
        if (REDIS_HOST) {
            const statHash = `${tableStatsName}:${keyId}`;
            await this.hIncrBy(statHash, `accum_${counter}`, 1);
        } else if (this[tableStatsName][keyId]) {
            this[tableStatsName][keyId][counter].countMessage();
        }
    }

    /**
     * Updates data in the specified table based on the provided timestamp.
     * @param {string} tableName - The name of the table.
     * @param {string} indexName - The name of the table index.
     * @param {Object} data - The updated data.
     * @param {number} timeStamp - The timestamp of the updated data.
     * @returns {Promise} A promise that resolves with a status code.
     */
    async update(tableName: string, indexName: string, data: any, storeTimeStamp: Date | null, mode = 'buffered',
        msgTimeStamp: Date | null = null, dbService:  DatabaseService | null = null): Promise<boolean> {

        if (!storeTimeStamp) {
            storeTimeStamp = new Date(0);
        }
        if (!msgTimeStamp) {
            msgTimeStamp = storeTimeStamp;
        }
        const keyId = data[indexName];
        const table = this[tableName];
        const tableStats = this[`${tableName}_stats`];

        // Initialize local inMem register
        if (!data.last_message_time) {
            Object.assign(data, {
                'last_message_time': storeTimeStamp,
            });
        }
        table[keyId] = table[keyId] ? table[keyId] : {
            'last_message_time': storeTimeStamp,
        };
        Object.assign(table[keyId], data);

        // Instance local statistics
        if (!tableStats[keyId]) {
            tableStats[keyId] = {
                msgPerSecond: new UpdateStats(),
                updtPerSecond: new UpdateStats(),
                errorPerSecond: new UpdateStats(10),
            };
        }

        if (REDIS_HOST) {
            const entityHash = `${tableName}:${keyId}`;
            if (mode === 'realtime' && dbService) {
                this.countMessages(`${tableName}_stats`, keyId, 'updtPerSecond');
                await Promise.all([this.hSetAsync(entityHash, data),
                    dbService.update(indexName, keyId, data), //Loop?
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

            if (mode === 'realtime' && dbService) {
                this.countMessages(`${tableName}_stats`, keyId, 'updtPerSecond');
                this.updateBuffer(tableName, indexName, data, storeTimeStamp);
                await dbService.update(indexName, keyId, data); // Loop?
                return true;
            }
            if (mode == 'buffered') {
                if ((storeTimeStamp.getTime() - msgTimeStamp.getTime()) < MAX_DELAY) {
                    this.updateBuffer(tableName, indexName, data, storeTimeStamp);
                    return true;
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
    async delete(tableName: string, indexName: string, dataId: string): Promise<void> {
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
    async flush(tableName: string, indexName: string, dbService: DatabaseService, maxAge = 0): Promise<any> {
        const now = new Date();
        this.lastFlushTime = now;
        const elapsed_time: number = now.getTime() - this.startTime.getTime();

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
        let statData = {};
        if (REDIS_HOST) {
            bufferedData = await this.getAndDeleteHashesByPattern(`${tableBufferName}:*`);
            if (elapsed_time > STAT_ACCUM_PERIOD) {
                statData = await this.getAndDeleteHashesByPattern(`${tableStatsName}:*`);
                this.startTime = now;
            }
        } else {
            bufferedData = {
                ...this[tableBufferName],
            }; //Get &
            this[tableBufferName] = {};                //Delete
            statData = this[tableStatsName];
        }
        // Nothing to do if buffer is empty
        if (Object.keys(bufferedData).length === 0) {
            return null;
        }

        const promiseArray = Object.keys(bufferedData) // Objects to be updated in the postgres database
            .map(async key => {

                let msgPerSecond; let updtPerSecond;
                // Parse the stats local key and remote hash
                const bufferKeys = key.split(':');
                const keyId = bufferKeys.length > 1 ? bufferKeys[1] : bufferKeys[0];
                const statHash = `${tableStatsName}:${keyId}`;
                await this.countMessages(tableStatsName, keyId, 'updtPerSecond');

                if (REDIS_HOST && statData[statHash]) {
                    msgPerSecond = statData[statHash].accum_msgPerSecond / (elapsed_time / 1000);
                    updtPerSecond = statData[statHash].accum_updtPerSecond / (elapsed_time / 1000);
                    bufferedData[key].msg_per_sec = msgPerSecond;
                    bufferedData[key].updt_per_sec = updtPerSecond;
                }
                if (!REDIS_HOST && statData[keyId]) {
                    msgPerSecond = statData[keyId].msgPerSecond.countsPerSecond;
                    updtPerSecond = statData[keyId].updtPerSecond.countsPerSecond;
                    bufferedData[key].msg_per_sec = msgPerSecond;
                    bufferedData[key].updt_per_sec = updtPerSecond;
                }

                // State information is exclusively saved by state_event_handler module
                delete bufferedData[key]['status'];
                delete bufferedData[key]['resources'];

                // Delete properties that are relevant only for agents:
                if (tableName !== 'agents') {
                    // delete this[tableName][key]['last_message_time'];
                    delete bufferedData[key]['updt_per_sec'];
                    delete bufferedData[key]['msg_per_sec'];
                    delete bufferedData[key]['_leaderAgents'];
                }

                return bufferedData[key];
            });

        const objArray = await Promise.all(promiseArray);
        const promiseTrigger = () => dbService.updateMany(objArray, indexName, useShortTimeOutClient)
            .then((r) => {
                if (r && r.length) {
                    const failedDataTypeError = r.filter(e => e && e.error && e.error.message.includes('constraint'));
                    const failedIndexes = r.filter(e => e && e.error && !e.error.message.includes('constraint'));

                    failedDataTypeError.forEach(e => {
                        logData.addLog('helyos_core', {
                            uuid: e.failedIndex,
                        }, 'error', `Update failed on ${tableName} / ${e.failedIndex} ${e.error.message}`);
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
    async updateBuffer(tableName: string, indexName: string, data: any, timeStamp: Date): Promise<void> {
        const keyId = data[indexName];
        const tableBufferName = `${tableName}_buffer`;
        const tableBuffer = this[tableBufferName];
        const entityBufferHash = `${tableBufferName}:${keyId}`;
        data['last_message_time'] = timeStamp;

        if (REDIS_HOST) {
            await this.hSetAsync(entityBufferHash, data);
        }

        if (!REDIS_HOST) {
            if (tableBuffer[keyId]) {
                Object.assign(tableBuffer[keyId], data);
            } else {
                tableBuffer[keyId] = data;
            }
        }

    }

    dispatchUpdatePromise(promiseTrigger: () => Promise<any>, numberUpdates = 1): Promise<void> {
        if (this.pendingPromises > 2 * this.limitWaitingFlushes) {
            this.lostUpdates += numberUpdates;
            return Promise.resolve();
        }
        this.pendingPromises++;

        return promiseTrigger()
            .finally(() => this.pendingPromises--);

    }

    getHistoricalCountRateAverage(tableName: string, index: string, minSample = 10): { avgMsgPerSecond: number, avgUpdtPerSecond: number } {
        const tableStatsName = `${tableName}_stats`;
        let avgMsgPerSecond = 0; let avgUpdtPerSecond = 0;

        if (!this[tableStatsName] || !this[tableStatsName][index] || !this[tableStatsName][index]['updtPerSecond']) {
            return {
                avgMsgPerSecond,
                avgUpdtPerSecond,
            };
        }

        const msgPerSecondH = this[tableStatsName][index]['msgPerSecond'].countsPerSecondHistory;
        if (msgPerSecondH.length >= minSample) {
            const sum = this[tableStatsName][index]['msgPerSecond'].countsPerSecondMovingAcumm;
            avgMsgPerSecond = (sum / msgPerSecondH.length);
        }

        const updtPerSecondH = this[tableStatsName][index]['updtPerSecond'].countsPerSecondHistory;
        if (updtPerSecondH.length >= minSample) {
            const sum = this[tableStatsName][index]['updtPerSecond'].countsPerSecondMovingAcumm;
            avgUpdtPerSecond = (sum / updtPerSecondH.length);
        }
        return {
            avgMsgPerSecond,
            avgUpdtPerSecond,
        };
    }

    _catch_update_errors(n = 1) {
        if (this.lostUpdates === 0) {
            this.timeoutCounterStartTime = new Date();
        }

        this.lostUpdates += n;
        const now = new Date();
        if (now.getTime()  - this.timeoutCounterStartTime!.getTime()  > 10000) {
            if (this.updateTimeout === this.shortTimeout || this.lostUpdates > 5) {
                logData.addLog('helyos_core', null, 'warn', `Too many updates pushed to the database. The timeout was reduced to ${this.shortTimeout} milliseconds to avoid the system blockage.`);
            }
            logData.addLog('helyos_core', null, 'error',
                `${this.lostUpdates} database updates canceled. Pending promises:${this.pendingPromises}. Timeout: ${this.updateTimeout / 1000} secs. Try to increase the buffer time, DB_BUFFER_TIME.`);
            console.warn(`${this.lostUpdates} database updates canceled. Pending promises:${this.pendingPromises}. Timeout: ${this.updateTimeout / 1000} secs. Try to increase the buffer time, DB_BUFFER_TIME.`);
            this.lostUpdates = 0;
            this.timeoutCounterStartTime = new Date();
        }
    }

    async _dynamicallyChooseTimeout() {
        if (this.pendingPromises > this.limitWaitingFlushes) {
            if (this.updateTimeout === this.longTimeout) {
                this.updateTimeout = this.shortTimeout;
                return setDBTimeout(this.updateTimeout);
            }
        }

        if (this.pendingPromises < Math.round(this.limitWaitingFlushes / 2)) {
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
    startTimePerId: Record<string, Date> = {};
    static instance: DataRetriever | null = null;
    dbServices: any;
    inMemDB: InMemDB;
    requiredFields: string[];
    reloadPeriod: number;
    tableName: string;

    constructor(inMemDB: InMemDB, dbServices: any, tableName: string, requiredFields: string[], reloadPeriod = 2000) {
        this.dbServices = dbServices;
        this.inMemDB = inMemDB;
        this.requiredFields = [...requiredFields];
        if (this.requiredFields.indexOf('modified_at') === -1) {
            this.requiredFields.push('modified_at');
        }
        this.reloadPeriod = reloadPeriod;
        this.tableName = tableName;
        DataRetriever.instance = this;
    }

    static getInstance(inMemDB: InMemDB, dbServices: any,
        tableName: string, requiredFields: string[], reloadPeriod = 2000): DataRetriever {
        if (!DataRetriever.instance) {
            DataRetriever.instance = new DataRetriever(inMemDB, dbServices, tableName, requiredFields, reloadPeriod);
        }
        return DataRetriever.instance;
    }

    getData(index: string, indexName = 'uuid', reload = false): Promise<any> {

        if (this.startTimePerId[index] === undefined) {
            this.startTimePerId[index] = new Date();
        }
        const now = new Date();
        const deltaTime = (now.getTime() - this.startTimePerId[index].getTime());

        let _reload:  'IN_MEM'  | 'POSTGRES' | null = null;
        if (deltaTime > this.reloadPeriod) {
            _reload = "POSTGRES";
        }

        // COMMENT: When is the directly retrieve from external In mem database necessary?
        // if (deltaTime > ? ) { _reload = "IN_MEM"};
        // if (_reload === "IN_MEM") {
        //     this.startTimePerId[index] = new Date();
        // }

        if (_reload === "POSTGRES") {
            this.startTimePerId[index] = new Date();
        }

        return this.getDataFromSelectedSource(index, indexName, _reload);
    }

    async getDataFromSelectedSource(index, indexName = 'uuid', reload: any = null) {
        let _reload = reload;

        // If required fields is not available in external in-Mem DBm try Postgress
        if (_reload === null) {
            const inMemLocalData = this.inMemDB[this.tableName][index];
            if (inMemLocalData && this.requiredFields.every(field => inMemLocalData[field] !== undefined)) {
                return inMemLocalData;
            } else {
                _reload = "IN_MEM";
            }
        }

        // If required fields is not available in external in-Mem DBm try Postgress
        if (_reload === "IN_MEM") {
            const inMemServerData = await this.inMemDB.get(this.tableName, index) || {};
            if (inMemServerData && this.requiredFields.every(field => inMemServerData[field] !== undefined)) {
                // console.log("return server \n")
                return inMemServerData;
            } else {
                _reload = "POSTGRES";
            }
        }

        if (_reload === "POSTGRES") {
            return this.dbServices[this.tableName].get(indexName, index, this.requiredFields)
                .then((r) => {
                    if (r.length) {
                        this.inMemDB.update(this.tableName, indexName, r[0], new Date(), 'realtime', null, this.dbServices[this.tableName]);
                        return r[0];
                    } else {
                        return null;
                    }
                });
        }

    }

}

// Helper class for calculating the average count rate.
class UpdateStats {
    counts = 0;
    startCountingTime = new Date();
    countsPerSecond = 0;
    elapsed_time = 0;
    minSample = 100;
    historyLength = 50;
    countsPerSecondHistory: number[] = [];
    countsPerSecondMovingAcumm = 0;

    constructor(minSample = 100) {
        this.minSample = minSample;
    }

    countMessage() {
        this.counts += 1;
        if (this.counts === 1) {
            this.startCountingTime = new Date();
        }
        if (this.counts === this.minSample) {
            const now = new Date();
            this.elapsed_time = (now.getTime() - this.startCountingTime.getTime()) / 1000;
            this.countsPerSecond = this.counts / this.elapsed_time;
            this.countsPerSecondHistory.push(this.countsPerSecond);
            this.countsPerSecondMovingAcumm = this.countsPerSecondMovingAcumm + this.countsPerSecond;
            if (this.countsPerSecondHistory.length > this.historyLength) {
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
        console.log('====> Creating In Memory Database Service instance');

        let redisClients;
        if (REDIS_HOST) {
            await redisAccessLayer.ensureConnected();
            redisClients = {
                'subscriber': redisAccessLayer.subClient,
                'publisher': redisAccessLayer.pubClient,
            };
        } else {
            redisClients = {
                'subscriber': null,
                'publisher': null,
            };
        }
        inMemDB = new InMemDB(redisClients, LONG_TIMEOUT, SHORT_TIMEOUT, MAX_PENDING_UPDATES);

        console.log('====> In Memory Database Service created');
    }
    return inMemDB;
}

async function disconnect() {
    if (inMemDB && REDIS_HOST) {
        await inMemDB.client.quit();
        await inMemDB.subClient.quit();
    }
}

export {
    InMemDB, DataRetriever, getInstance, disconnect,
};