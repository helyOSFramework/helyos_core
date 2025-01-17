import { createClient, RedisClientType } from 'redis';
import config from '../../config';
import { serializeNonStringValues, parseObjectValues } from '../../modules/utils';

const {
    REDIS_HOST, REDIS_PORT, REDIS_PASSWORD,
} = config;

interface RedisClient extends RedisClientType<any, any, any> {}
let pubClient: RedisClient | undefined;
let subClient: RedisClient | undefined;
let pubForSocketIOServer: RedisClient | undefined;
let subForSocketIOServer: RedisClient | undefined;

if (REDIS_HOST) {
    pubClient = createClient({
        socket: {
            host: REDIS_HOST,
            port: REDIS_PORT as number,
        },
        password: REDIS_PASSWORD,
    });

    subClient = pubClient.duplicate();

    pubForSocketIOServer = createClient({
        socket: {
            host: REDIS_HOST,
            port: REDIS_PORT as number,
        },
        password: REDIS_PASSWORD,
    });

    subForSocketIOServer = pubForSocketIOServer.duplicate();

    pubClient.on('connect', () => {
        console.log('Pub client Connected to Redis');
    });

    pubClient.on('error', (error: Error) => {
        console.error('Pub client Redis connection error:', error);
    });

    subClient.on('connect', () => {
        console.log('Sub client Connected to Redis');
    });

    subClient.on('error', (error: Error) => {
        console.error('Sub client Redis connection error:', error);
    });
}

async function ensureConnected(): Promise<void> {
    if (!pubClient || !subClient || !pubForSocketIOServer || !subForSocketIOServer) {
        throw new Error('Redis clients not initialized');
    }
    if (!pubClient.isOpen) {
        await pubClient.connect();
    }
    if (!subClient.isOpen) {
        await subClient.connect();
    }
    if (!pubForSocketIOServer.isOpen) {
        await pubForSocketIOServer.connect();
    }
    if (!subForSocketIOServer.isOpen) {
        await subForSocketIOServer.connect();
    }
}

function initClient(): Promise<any[]> {
    if (!pubClient || !subClient || !pubForSocketIOServer || !subForSocketIOServer) {
        throw new Error('Redis clients not initialized');
    }
    return Promise.all([
        pubClient.connect(),
        subClient.connect(),
        pubForSocketIOServer.connect(),
        subForSocketIOServer.connect(),
    ]);
}

function getValue(client: RedisClient, key: string): Promise<string | null> {
    return client.get(key).catch((error: Error) => {
        console.error(`Error getting value for key ${key}:`, error);
        throw error;
    });
}

function setValue(client: RedisClient, key: string, value: string): Promise<any> {
    return client.set(key, value).catch((error: Error) => {
        console.error(`Error setting value for key ${key}:`, error);
        throw error;
    });
}

function getManyValues(client: RedisClient, keys: string[]): Promise<(string | null)[]> {
    return client.mGet(keys).catch((error: Error) => {
        console.error('Error getting many values:', error);
        throw error;
    });
}

function setManyValues(client: RedisClient, keyValuePairs: Record<string, string>): Promise<any> {
    return client.mSet(keyValuePairs).catch((error: Error) => {
        console.error('Error setting many values:', error);
        throw error;
    });
}

function deleteKey(client: RedisClient, key: string): Promise<any> {
    return client.del(key).catch((error: Error) => {
        console.error(`Error deleting key ${key}:`, error);
        throw error;
    });
}

function deleteManyKeys(client: RedisClient, keys: string[]): Promise<any> {
    const pipeline = client.multi();
    keys.forEach(key => pipeline.del(key));
    return pipeline.exec().catch((error: Error) => {
        console.error('Error deleting many keys:', error);
        throw error;
    });
}

function getAndDeleteKey(client: RedisClient, key: string): Promise<string | null> {
    const pipeline = client.multi();
    pipeline.get(key);
    pipeline.del(key);
    return pipeline.exec().then(results => results![0]![1]).catch((error: Error) => {
        console.error(`Error getting and deleting key ${key}:`, error);
        throw error;
    });
}

function getAllKeys(client: RedisClient, pattern: string = '*'): Promise<string[]> {
    return client.keys(pattern).catch((error: Error) => {
        console.error('Error getting all keys:', error);
        throw error;
    });
}

function hSet(client: RedisClient, hash: string, fields: Record<string, any>): Promise<any> {
    const _fields = serializeNonStringValues(fields);
    return client.hSet(hash, _fields).catch((error: Error) => {
        console.error(`Error setting fields in hash ${hash}:`, error);
        throw error;
    });
}

function hGet(client: RedisClient, hash: string, field: string): Promise<any > {
    return client.hGet(hash, field).catch((error: Error) => {
        console.error(`Error getting field ${field} from hash ${hash}:`, error);
        throw error;
    });
}

function hGetAll(client: RedisClient, hash: string): Promise<Record<string, any>> {
    return client.hGetAll(hash).then(object => parseObjectValues(object)).catch((error: Error) => {
        console.error(`Error getting all fields from hash ${hash}:`, error);
        throw error;
    });
}

async function getHashesByPattern(client: RedisClient, pattern: string): Promise<Record<string, any>> {
    try {
        const result: Record<string, any> = {};

        for await (const key of client.scanIterator({
            MATCH: pattern,
        })) {
            const hashData = await hGetAll(client, key);
            if (hashData && Object.keys(hashData).length > 0) {
                result[key] = hashData;
            }
        }

        return result;
    } catch (error) {
        console.error('Error fetching hashes:', pattern, error);
        throw error;
    }
}

function hIncrBy(client: RedisClient, hash: string, field: string, increment: number): Promise<number> {
    return client.hIncrBy(hash, field, increment).catch((error: Error) => {
        console.error(`Error incrementing field ${field} in hash ${hash}:`, error);
        throw error;
    });
}

function hExists(client: RedisClient, hash: string, field: string): Promise<boolean> {
    return client.hExists(hash, field).catch((error: Error) => {
        console.error(`Error checking existence of field ${field} in hash ${hash}:`, error);
        throw error;
    });
}

function deleteHash(client: RedisClient, hash: string): Promise<any> {
    return client.del(hash).catch((error: Error) => {
        console.error(`Error deleting hash ${hash}:`, error);
        throw error;
    });
}

async function getAndDeleteHash(client: RedisClient, hash: string): Promise<Record<string, any>> {
    try {
        await ensureConnected();

        const pipeline = client.multi();
        pipeline.hGetAll(hash);
        pipeline.del(hash);

        const [getResult, delResult] = await pipeline.exec();

        if (!getResult || getResult[0] !== null) {
            throw new Error(`Failed to get hash ${hash}`);
        }

        return getResult[1];

    } catch (error) {
        console.error(`Error getting and deleting hash ${hash}:`, error);
        throw error;
    }
}

async function acquireLock(client: RedisClient, lockKey: string, expireTime: number = 2): Promise<boolean> {
    const result = await client.set(lockKey, 'locked', {
        NX: true,
        EX: expireTime,
    });
    return result === 'OK';
}

async function releaseLock(client: RedisClient, lockKey: string): Promise<void> {
    await client.del(lockKey);
}

async function getAndDeleteHashesByPattern(client: RedisClient, pattern: string): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    const keysToDelete: string[] = [];
    const lockKey = `locks:${pattern}`;

    try {
        const lockAcquired = await acquireLock(client, lockKey);
        if (!lockAcquired) {
            console.log(`Could not acquire Mem db lock ${pattern}, operation skipped.`);
            return {};
        }

        const multi = client.multi();
        const scanIterator = client.scanIterator({
            MATCH: pattern,
        });

        for await (const key of scanIterator) {
            multi.hGetAll(key);
            keysToDelete.push(key);
        }

        const responses = await multi.exec();

        for (let i = 0; i < responses.length; i++) {
            const hashData = responses[i];
            if (hashData && Object.keys(hashData).length > 0) {
                result[keysToDelete[i]] = parseObjectValues(hashData as any);
            }
        }

        if (keysToDelete.length > 0) {
            await client.multi().del(keysToDelete).exec();
        }

        return result;
    } catch (error) {
        console.error('Error fetching and deleting hashes with pattern:', pattern);
        console.error('Error details:', error);
        throw error;
    } finally {
        await releaseLock(client, lockKey);
    }
}

if (REDIS_HOST) {
    initClient().catch((error: Error) => {
        console.error('Error initializing Redis client:', error);
        process.exit(1);
    });
}

export {
    pubClient,
    subClient,
    pubForSocketIOServer,
    subForSocketIOServer,
    ensureConnected,
    getValue,
    setValue,
    getManyValues,
    setManyValues,
    deleteKey,
    deleteManyKeys,
    getAndDeleteKey,
    getAllKeys,
    getHashesByPattern,
    getAndDeleteHashesByPattern,
    hSet,
    hGet,
    hGetAll,
    hIncrBy,
    hExists,
    deleteHash,
    getAndDeleteHash,
    REDIS_HOST,
    RedisClient,
};