// Retrieve Redis connection details from environment variables
const REDIS_HOST = process.env.REDIS_HOST || '';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'mypass';

const { serializeNonStringValues, parseObjectValues } = require('../../modules/utils')
const { createClient } = require('redis');

if (!REDIS_HOST) return;

// Create Redis client
const pubClient = createClient({
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  },
  password: REDIS_PASSWORD,
});

const subClient = pubClient.duplicate();

const pubForSocketIOServer = createClient({
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  },
  password: REDIS_PASSWORD,
});

const subForSocketIOServer = pubForSocketIOServer.duplicate();


async function ensureConnected() {
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


// Handle connection events

pubClient.on('connect', () => {
  console.log('Pub client Connected to Redis');
});

pubClient.on('error', (error) => {
  console.error('Pub client Redis connection error:', error);
});

subClient.on('connect', () => {
  console.log('Sub client Connected to Redis');
});

subClient.on('error', (error) => {
  console.error('Sub client Redis connection error:', error);
});

// Initialize the Redis client
function initClient() {
  return Promise.all([pubClient.connect(), subClient.connect(), pubForSocketIOServer.connect(), subForSocketIOServer.connect()]);
}

// Get value from key
function getValue(client, key) {
  return client.get(key)
    .catch(error => {
      console.error(`Error getting value for key ${key}:`, error);
      throw error;
    });
}

// Set value for key
function setValue(client, key, value) {
  return client.set(key, value)
    .catch(error => {
      console.error(`Error setting value for key ${key}:`, error);
      throw error;
    });
}

// Get many values from many keys
function getManyValues(client, keys) {
  return client.mGet(keys)
    .catch(error => {
      console.error('Error getting many values:', error);
      throw error;
    });
}

// Set many values for many keys
function setManyValues(client, keyValuePairs) {
  return client.mSet(keyValuePairs)
    .catch(error => {
      console.error('Error setting many values:', error);
      throw error;
    });
}

// Delete key
function deleteKey(client, key) {
  return client.del(key)
    .catch(error => {
      console.error(`Error deleting key ${key}:`, error);
      throw error;
    });
}

// Delete many keys
function deleteManyKeys(client, keys) {
  const pipeline = client.multi();
  keys.forEach(key => pipeline.del(key));
  return pipeline.exec()
    .catch(error => {
      console.error('Error deleting many keys:', error);
      throw error;
    });
}

// Get and delete key in a single atomic operation
function getAndDeleteKey(client, key) {
  const pipeline = client.multi();
  pipeline.get(key);
  pipeline.del(key);
  return pipeline.exec()
    .then(results => results[0][1])  // Return the value retrieved before deletion
    .catch(error => {
      console.error(`Error getting and deleting key ${key}:`, error);
      throw error;
    });
}

// Get all keys from a table (pattern matching)
function getAllKeys(client, pattern = '*') {
  return client.keys(pattern)
    .catch(error => {
      console.error('Error getting all keys:', error);
      throw error;
    });
}

// Set multiple fields in a hash with an object
function hSet(client, hash, fields) {
  const _fields = serializeNonStringValues(fields)
  return client.hSet(hash, _fields)
    .catch(error => {
      console.error(`Error setting fields in hash ${hash}:`, error);
      throw error;
    });
}

// Get a specific field from a hash
function hGet(client, hash, field) {
  return client.hGet(hash, field)
    .catch(error => {
      console.error(`Error getting field ${field} from hash ${hash}:`, error);
      throw error;
    });
}


// Get all fields and values from a hash
function hGetAll(client, hash) {
  return client.hGetAll(hash)
    .then(object => parseObjectValues(object))
    .catch(error => {
      console.error(`Error getting all fields from hash ${hash}:`, error);
      throw error;
    });
}



async function getHashesByPattern(client, pattern) {
  try {
    const result = {};

    for await (const key of client.scanIterator({ MATCH: pattern })) {
      const hashData = await hGetAll(client, key);
      if (Object.keys(hashData).length > 0) {
        result[key] = hashData;
      }
    }


    return result;

  } catch (error) {
    console.error('Error fetching hashes:', pattern, error);
    throw error;
  }
}





// Delete one or more fields from a hash, using an object where keys are fields
function hDel(client, hash, fields) {
  // Convert object keys to an array of field names
  const fieldNames = Object.keys(fields);
  return client.hDel(hash, ...fieldNames)
    .catch(error => {
      console.error(`Error deleting fields from hash ${hash}:`, error);
      throw error;
    });
}

// Increment the integer value of a field in a hash
function hIncrBy(client, hash, field, increment) {
  return client.hIncrBy(hash, field, increment)
    .catch(error => {
      console.error(`Error incrementing field ${field} in hash ${hash}:`, error);
      throw error;
    });
}

// Check if a field exists in a hash
function hExists(client, hash, field) {
  return client.hExists(hash, field)
    .catch(error => {
      console.error(`Error checking existence of field ${field} in hash ${hash}:`, error);
      throw error;
    });
}

// Delete an entire hash
function deleteHash(client, hash) {
  return client.del(hash)
    .catch(error => {
      console.error(`Error deleting hash ${hash}:`, error);
      throw error;
    });
}

// Get all fields and values from a hash, then delete the hash in a single atomic operation
async function getAndDeleteHash(client, hash) {
  try {
    await ensureConnected();  // Ensure the client is connected

    const pipeline = client.multi();
    pipeline.hGetAll(hash);  // Get all fields from the hash
    pipeline.del(hash);     // Delete the hash

    const [getResult, delResult] = await pipeline.exec();  // Execute both commands atomically

    return getResult[1];    // Return the result of hGetAll, which is the hash contents
  } catch (error) {
    console.error(`Error getting and deleting hash ${hash}:`, error);
    throw error;
  }
}



async function acquireLock(client, lockKey, expireTime = 2) {
  const result = await client.set(lockKey, 'locked', {
    NX: true, // Set if not exists
    EX: expireTime // Expiration time in seconds
  });
  return result === 'OK'; // Returns true if lock acquired
}

async function releaseLock(client, lockKey) {
  await client.del(lockKey);
}

async function getAndDeleteHashesByPattern(client, pattern) {
  const result = {};
  const keysToDelete = [];
  const lockKey = `locks:${pattern}`;

  try {
    // Attempt to acquire the lock
    const lockAcquired = await acquireLock(client, lockKey);
    if (!lockAcquired) {
      console.log(`Could not acquire Mem db lock ${pattern}, operation skipped.`);
      return {};
    }

    // Start a transaction for hash retrieval
    const multi = client.multi();
    const scanIterator = client.scanIterator({ MATCH: pattern });

    // Queue hash retrieval commands
    for await (const key of scanIterator) {
      multi.hGetAll(key);
      keysToDelete.push(key); // Collect keys for deletion
    }

    // Execute the transaction to retrieve all hashes
    const responses = await multi.exec();

    // Process the responses from the multi transaction
    for (let i = 0; i < responses.length; i++) {
      const hashData = responses[i];
      if (Object.keys(hashData).length > 0) {
        result[keysToDelete[i]] = parseObjectValues(hashData);
      }
    }

    // Perform deletion in a separate transaction to ensure atomicity of deletion
    if (keysToDelete.length > 0) {
      await client.multi().del(keysToDelete).exec();
    }

    return result;

  } catch (error) {
    console.error('Error fetching and deleting hashes with pattern:', pattern);
    console.error('Error details:', error);
    throw error;

  } finally {
    // Release the lock
    await releaseLock(client, lockKey);
  }
}





// Initialize client on module load
initClient()
  .catch(error => {
    console.error('Error initializing Redis client:', error);
    process.exit(1);
  });

module.exports = {
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
  hDel,
  hIncrBy,
  hExists,
  deleteHash,
  getAndDeleteHash,
  REDIS_HOST
};
