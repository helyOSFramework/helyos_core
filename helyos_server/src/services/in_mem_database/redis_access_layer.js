// Retrieve Redis connection details from environment variables
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'mypass';


const { createClient } = require('redis');

// Create Redis client
const client = createClient({
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  },
  password: REDIS_PASSWORD,
});

// Handle connection events
async function ensureConnected() {
    if (!client.isOpen) {
      await client.connect();
    }
  }

client.on('connect', () => {
  console.log('Connected to Redis');
});

client.on('error', (error) => {
  console.error('Redis connection error:', error);
});

// Initialize the Redis client
function initClient() {
  return client.connect();
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

// Initialize client on module load
initClient()
  .catch(error => {
    console.error('Error initializing Redis client:', error);
    process.exit(1);
  });

module.exports = {
  client,
  ensureConnected,
  getValue,
  setValue,
  getManyValues,
  setManyValues,
  deleteKey,
  deleteManyKeys,
  getAndDeleteKey,
  getAllKeys,
};