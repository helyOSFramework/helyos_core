const config = require('./config.js');
const databaseServices = require('./services/database/database_services.js');
const rbmqServices = require('./services/message_broker/rabbitMQ_services.js');
const { logData } = require('./modules/systemlog.js');

const agentComm = require('./modules/communication/agent_communication.js');
const microserviceWatcher = require('./event_handlers/microservice_event_watcher.js');
const inMemDBFlusher = require('./event_handlers/in_mem_db_flusher.js');
const util = require('util');
const fs = require('fs');
const readYML = require('./modules/read_config_yml.js');
const roleManagerModule = require('./role_manager.js');

const { MESSAGE_RATE_LIMIT, MESSAGE_UPDATE_LIMIT,
        AGENT_IDLE_TIME_OFFLINE, DB_BUFFER_TIME } = config;

const { CHECK_IN_QUEUE, AGENT_MISSION_QUEUE, 
        AGENT_VISUALIZATION_QUEUE, AGENT_UPDATE_QUEUE,
        AGENTS_UL_EXCHANGE,AGENTS_DL_EXCHANGE, RBMQ_VHOST,
        AGENTS_MQTT_EXCHANGE, ANONYMOUS_EXCHANGE,
        AGENT_STATE_QUEUE, SUMMARY_REQUESTS_QUEUE, 
        YARD_VISUALIZATION_QUEUE, CREATE_RBMQ_ACCOUNTS } = config;

const { handleBrokerMessages } = require('./event_handlers/rabbitmq_event_subscriber.js');
const {NUM_THREADS, HELYOS_REPLICA} =  config;
// Settings for horizontal scaling
const replicaOrMultiThread = HELYOS_REPLICA || (NUM_THREADS > 1);


// ----------------------------------------------------------------------------
// Initialization of the back-end
// ----------------------------------------------------------------------------


const initWatchers = () => {
    agentComm.watchWhoIsOnline(AGENT_IDLE_TIME_OFFLINE);
    agentComm.watchMessageRates(MESSAGE_RATE_LIMIT, MESSAGE_UPDATE_LIMIT);
    microserviceWatcher.initWatcher();
    inMemDBFlusher.initWatcher(DB_BUFFER_TIME);
};


/**
* setInitialDatabaseData()
* Pre-populate the database.
*/
const setInitialDatabaseData = async () => {
    // populate services data 
    if (readYML.registerManyMicroservices('/etc/helyos/config/microservices.yml')) {
        console.log(' ====== microservices.yml file processed =====')
    }
    else {
        console.warn('microservice config file not fully processed.')
    }

    // populate missions data 
    if (readYML.registerMissions('/etc/helyos/config/missions.yml')) {
        console.log(' ====== mission.yml file processed =====')
    } else {
        console.warn('mission config file not fully processed.')
    }

    // populate agents
    try {
        agentPublicKeyFiles = fs.readdirSync('/etc/helyos/.ssl_keys/agent_public_keys');
        await createOrUpdateAgents(agentPublicKeyFiles);

    } catch (error) {
        console.warn('storing agent public keys failed.', error);
    }

    // Save environment variables for RabbitMQ
    try {
        const patch = {
         'agents_ul_exchange': AGENTS_UL_EXCHANGE,
         'agents_dl_exchange': AGENTS_DL_EXCHANGE,
         'agents_mqtt_exchange': AGENTS_MQTT_EXCHANGE,
         'agents_anonymous_exchange': ANONYMOUS_EXCHANGE,
         'rbmq_vhost': RBMQ_VHOST
        }
        const rbmq_config = await databaseServices.rbmq_config.get('rbmq_vhost', RBMQ_VHOST, ['id']);
        if (rbmq_config.length) {
             await databaseServices.rbmq_config.update_byId(config.id, patch);
        } else {
             await databaseServices.rbmq_config.insert(patch);
        }
     } catch (error) {
         console.warn('storing environment variables failed.', error);
         return null;
     }

}



/**
 * createOrUpdateAgents(filenames) 
 * Register agents in the database by listing the public key files saved in the agent_public_keys folder. 
 * The agent UID will be the name of the file wihout extension.
 *
 * @param {string[]} fileNames
 * @returns {Promise<any>}
 */
function createOrUpdateAgents(fileNames) {
    const promises = fileNames.map(fileName => {
        if (!fileName) { return Promise.resolve(0) }
        const uuid = fileName.split('.')[0];
        const pubKey = fs.readFileSync(`/etc/helyos/.ssl_keys/agent_public_keys/${fileName}`, { encoding: 'utf8', flag: 'r' });
        return databaseServices.agents.get('uuid', uuid)
            .then(agents => {
                if (agents.length > 0) {
                    return databaseServices.agents.update('id', agents[0].id, { public_key: pubKey });
                } else {
                    console.log("create agent ", uuid);
                    return databaseServices.agents.insert({
                        uuid: uuid,
                        name: 'undefined',
                        message_channel: uuid,
                        connection_status: 'offline',
                        code: 'undefined',
                        public_key: pubKey
                    });
                }
            });
    });
    return Promise.all(promises);
}


/*
initializeRabbitMQAccounts()
helyOS needs to connect to rabbimq server as admin. 
This recursive routine checks if the set admin account is valid and try to create the admin account otherwise.
*/
function initializeRabbitMQAccounts() {
    if (!CREATE_RBMQ_ACCOUNTS) { return Promise.resolve(null) }
    logData.addLog('helyos_core', null, 'warn', 'Trying connecting to RabbitMQ using admin account...');
    return rbmqServices.connect_as_admin_and_create_accounts()
        .catch(e => {
            logData.addLog('helyos_core', null, 'warn', 'Trying guest account...');
            rbmqServices.connect_as_guest_and_create_admin()
                .catch(e => {
                    console.warn("\nWaiting AMQP server connection stabilize to create accounts...\n\n");
                    logData.addLog('helyos_core', null, 'warn', 'Waiting AMQP server stabilize to create accounts and connect...');
                    console.warn(e);
                });
            const promiseSetTimeout = util.promisify(setTimeout);
            return promiseSetTimeout(3000).then(() => initializeRabbitMQAccounts());
        });
}



async function helyosConsumingMessages(dataChannels) {
    const roleManager = await roleManagerModule.getInstance();
    const mainChannel = dataChannels[0];
    const secondaryChannel = dataChannels[1];
    console.log(`\n ================================================================` +
        `\n ================= SUBSCRIBE TO HELYOS' QUEUES ==================` +
        `\n ================================================================`);

    mainChannel.consume(CHECK_IN_QUEUE, (message) => handleBrokerMessages(mainChannel, CHECK_IN_QUEUE, message), { noAck: true, priority: 5 });
    mainChannel.consume(AGENT_MISSION_QUEUE, (message) => handleBrokerMessages(mainChannel, AGENT_MISSION_QUEUE, message), { noAck: true, priority: 5 });
    mainChannel.consume(SUMMARY_REQUESTS_QUEUE, (message) => handleBrokerMessages(mainChannel, SUMMARY_REQUESTS_QUEUE, message), { noAck: true });

    const becomingLeader = async (consumerTagsToCancel) => {
        await Promise.all(consumerTagsToCancel.map(cti => mainChannel.cancel(cti.consumerTag)));

        const ct1 = await mainChannel.consume(AGENT_STATE_QUEUE,
            (message) => handleBrokerMessages(mainChannel, AGENT_STATE_QUEUE, message),
            { noAck: false, priority: 10 });

        const ct2 = await mainChannel.consume(AGENT_UPDATE_QUEUE,
            (message) => handleBrokerMessages(mainChannel, AGENT_UPDATE_QUEUE, message),
            { noAck: false, priority: 5 });

        logData.addLog('helyos_core', null, 'warn', `Leader Node ${roleManager.NODE_ID} subscribed to state queues`);
        return [ct1, ct2];
    };

    const becomingFollower = async (consumerTagsToCancel) => {
        await Promise.all(consumerTagsToCancel.map(cti => mainChannel.cancel(cti.consumerTag)));

        console.log(`====> SUBSCRIBE TO VISUALIZATION QUEUE`);
        const ct1 = await secondaryChannel.consume(AGENT_VISUALIZATION_QUEUE,
            (message) => handleBrokerMessages(secondaryChannel, AGENT_VISUALIZATION_QUEUE, message),
            { noAck: true, priority: 1 });

        const ct2 = await secondaryChannel.consume(YARD_VISUALIZATION_QUEUE,
            (message) => handleBrokerMessages(secondaryChannel, YARD_VISUALIZATION_QUEUE, message),
            { noAck: true, priority: 1 });
        return [ct1, ct2];
    };


    if (replicaOrMultiThread) {
        await roleManager.tryToBecomeLeader(becomingLeader, becomingFollower);
        await roleManager.tryToBecomeBroadcaster(() => { }, () => { });
    } else {
        roleManager.amILeader = true;
        roleManager.role = 'broadcaster';
        becomingLeader([]);
        becomingFollower([]);
    }

    return dataChannels;
}


module.exports.initWatchers = initWatchers;
module.exports.initializeRabbitMQAccounts = initializeRabbitMQAccounts;
module.exports.setInitialDatabaseData = setInitialDatabaseData;
module.exports.helyosConsumingMessages = helyosConsumingMessages;

