const util = require('util');
const { logData} = require('./modules/systemlog.js');
const rbmqServices = require('./services/message_broker/rabbitMQ_services.js'); 
const databaseServices = require('./services/database/database_services.js');
const agentComm = require('./modules/communication/agent_communication.js');
const microserviceWatcher = require('./event_handlers/microservice_event_watcher.js');
const inMemDBWatcher = require('./event_handlers/in_mem_db_watcher.js');
const fs = require('fs');
const readYML = require('./modules/read_config_yml.js');

const AGENT_IDLE_TIME_OFFLINE = process.env.AGENT_IDLE_TIME_OFFLINE || 10; // Time of inactivity in seconds to consider an agent offline.
const DB_BUFFER_TIME = parseInt(process.env.DB_BUFFER_TIME || 1000);

const CREATE_RBMQ_ACCOUNTS = process.env.CREATE_RBMQ_ACCOUNTS || "True";
const { CHECK_IN_QUEUE, AGENT_MISSION_QUEUE,AGENT_VISUALIZATION_QUEUE,  AGENT_UPDATE_QUEUE,
        AGENT_STATE_QUEUE, SUMMARY_REQUESTS_QUEUE, YARD_VISUALIZATION_QUEUE } =  require('./services/message_broker/rabbitMQ_services.js');
const {handleBrokerMessages} = require('./event_handlers/rabbitmq_event_subscriber.js');

// Settings for horizontal scaling
let HELYOS_REPLICA = process.env.HELYOS_REPLICA || 'False';
HELYOS_REPLICA = HELYOS_REPLICA === 'True';


// ----------------------------------------------------------------------------
// Initialization of the back-end
// ----------------------------------------------------------------------------


const initWatchers = () => {
    agentComm.watchWhoIsOnline(AGENT_IDLE_TIME_OFFLINE);
    microserviceWatcher.initWatcher();
    inMemDBWatcher.initWatcher(DB_BUFFER_TIME);
};


/**
* setInitialDatabaseData()
* Pre-populate the database.
*/
const setInitialDatabaseData = () => {
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
        return createOrUpdateAgents(agentPublicKeyFiles);
        
    } catch (error) {
        return Promise.resolve(null);
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
            if(!fileName) {return Promise.resolve(0)}
            const uuid = fileName.split('.')[0];
            const pubKey = fs.readFileSync(`/etc/helyos/.ssl_keys/agent_public_keys/${fileName}`,  {encoding:'utf8', flag:'r'});
            return  databaseServices.agents.get('uuid', uuid)
                    .then( agents => {
                            if (agents.length > 0) {
                                    return databaseServices.agents.update('id', agents[0].id, {public_key: pubKey});
                            } else {
                                    console.log("create agent ", uuid);
                                    return databaseServices.agents.insert({uuid: uuid, 
                                                                name: 'undefined',
                                                                message_channel: uuid,
                                                                connection_status: 'offline',
                                                                code: 'undefined',
                                                                public_key: pubKey});
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
    if(CREATE_RBMQ_ACCOUNTS!=='True'){ return Promise.resolve(null)}
    logData.addLog('helyos_core', null, 'warn', 'Trying connecting to RabbitMQ using admin account...' );
    return rbmqServices.connect_as_admin_and_create_accounts()
            .catch(e => {
                logData.addLog('helyos_core', null, 'warn', 'Trying guest account...' );
                rbmqServices.connect_as_guest_and_create_admin()
                .catch (e => {               
                            console.warn("\nWaiting AMQP server connection stabilize to create accounts...\n\n");
                            logData.addLog('helyos_core', null, 'warn', 'Waiting AMQP server stabilize to create accounts and connect...' );
                            console.warn(e);
                });
                const promiseSetTimeout = util.promisify(setTimeout);
                return promiseSetTimeout(3000).then( () => initializeRabbitMQAccounts());
            });
}



    function helyosConsumingMessages (dataChannels) {
        const mainChannel = dataChannels[0];
        const secondaryChannel = dataChannels[1];
        console.log(`\n ================================================================`+
                    `\n ================= SUBSCRIBE TO HELYOS' QUEUES ==================`+
                    `\n ================================================================`);

        mainChannel.consume(CHECK_IN_QUEUE, (message)   => handleBrokerMessages(CHECK_IN_QUEUE, message), { noAck: true, priority: 5});
        mainChannel.consume(AGENT_STATE_QUEUE, (message) => handleBrokerMessages(AGENT_STATE_QUEUE, message), { noAck: true, priority: 10});
        mainChannel.consume(AGENT_UPDATE_QUEUE, (message) => handleBrokerMessages(AGENT_UPDATE_QUEUE, message), { noAck: true, priority: 5});
        mainChannel.consume(AGENT_MISSION_QUEUE, (message) => handleBrokerMessages(AGENT_MISSION_QUEUE, message), { noAck: true, priority: 5});
        secondaryChannel.consume(AGENT_VISUALIZATION_QUEUE, (message) => handleBrokerMessages(AGENT_VISUALIZATION_QUEUE, message), { noAck: true, priority: 1});
        secondaryChannel.consume(YARD_VISUALIZATION_QUEUE, (message) => handleBrokerMessages(YARD_VISUALIZATION_QUEUE, message), { noAck: true, priority: 1});


        mainChannel.consume(SUMMARY_REQUESTS_QUEUE, (message) => handleBrokerMessages(SUMMARY_REQUESTS_QUEUE, message), { noAck: true});
        return dataChannels;    
    }


module.exports.initWatchers = initWatchers;
module.exports.initializeRabbitMQAccounts = initializeRabbitMQAccounts;
module.exports.setInitialDatabaseData = setInitialDatabaseData;
module.exports.helyosConsumingMessages = helyosConsumingMessages;

