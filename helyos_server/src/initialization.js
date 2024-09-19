const util = require('util');
const { logData} = require('./modules/systemlog.js');
const rbmqServices = require('./services/message_broker/rabbitMQ_services.js'); 
const databaseServices = require('./services/database/database_services.js');
const agentComm = require('./modules/communication/agent_communication.js');
const microserviceWatcher = require('./event_handlers/microservice_event_watcher.js')
const fs = require('fs');
const readYML = require('./modules/read_config_yml.js');

const AGENT_IDLE_TIME_OFFLINE = process.env.AGENT_IDLE_TIME_OFFLINE || 10; // Time of inactivity in seconds to consider an agent offline.
const PREFETCH_COUNT = parseInt(process.env.PREFETCH_COUNT) || 100; // Number of messages to prefetch from the broker.
const TTL_VISUAL_MSG = parseInt(process.env.TTL_VISUAL_MSG) || 2000; // Time to live for visualization messages in ms.
const TTL_STATE_MSG = parseInt(process.env.TTL_STATE_MSG) || 360000; // Time to live for state messages in ms.

const CREATE_RBMQ_ACCOUNTS = process.env.CREATE_RBMQ_ACCOUNTS || "True";
const { AGENTS_UL_EXCHANGE, AGENTS_DL_EXCHANGE, ANONYMOUS_EXCHANGE, AGENT_MQTT_EXCHANGE } =  require('./services/message_broker/rabbitMQ_services.js');
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
    logData.addLog('helyos_core', null, 'warn', 'Trying connecting using admin account...' );
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


/*
configureRabbitMQSchema()
helyOS defines the topic exchanges and queues in the rabbitMQ schema.
*/
async function configureRabbitMQSchema(dataChannels) {
            const mainChannel = dataChannels[0];
            const secondaryChannel = dataChannels[1];
            await mainChannel.prefetch(PREFETCH_COUNT);
            await secondaryChannel.prefetch(PREFETCH_COUNT);

            console.log("===> Setting RabbitMQ Schema");
            // SET EXCHANGE ANONYMOUS TO RECEIVE/SEND MESSAGES FROM/TO AGENT
            await mainChannel.assertExchange(ANONYMOUS_EXCHANGE, 'topic', { durable: true });
            await rbmqServices.assertOrSubstituteQueue(mainChannel, CHECK_IN_QUEUE, false, true);
            await mainChannel.bindQueue(CHECK_IN_QUEUE, ANONYMOUS_EXCHANGE, "*.*.checkin" );

            // SET EXCHANGE "DOWN LINK" (DL) TO SEND MESSAGES TO AGENT 
            await mainChannel.assertExchange(AGENTS_DL_EXCHANGE, 'topic', { durable: true });

            // SET EXCHANGE "UP LINK" (UL) AND QUEUES TO RECEIVE MESSAGES FROM AGENT
            await mainChannel.assertExchange(AGENTS_UL_EXCHANGE, 'topic', { durable: true });

            // SET EXCHANGE FOR "MQTT" AGENTS AND QUEUES TO RECEIVE AND SEND MESSAGES TO AGENT. No exchange is used for MQTT
            await mainChannel.assertExchange(AGENT_MQTT_EXCHANGE, 'topic', { durable: true });

            await rbmqServices.assertOrSubstituteQueue(mainChannel, AGENT_UPDATE_QUEUE, false, true, {"x-message-ttl" : TTL_STATE_MSG});
            await mainChannel.bindQueue(AGENT_UPDATE_QUEUE, AGENTS_UL_EXCHANGE, "agent.*.update");
            await mainChannel.bindQueue(AGENT_UPDATE_QUEUE, AGENTS_UL_EXCHANGE, "agent.*.fact_sheet");     
            await mainChannel.bindQueue(AGENT_UPDATE_QUEUE, AGENT_MQTT_EXCHANGE, "agent.*.update");
            await mainChannel.bindQueue(AGENT_UPDATE_QUEUE, AGENT_MQTT_EXCHANGE, "agent.*.fact_sheet");

            await rbmqServices.assertOrSubstituteQueue(secondaryChannel, AGENT_VISUALIZATION_QUEUE, false, false, {"x-message-ttl" : TTL_VISUAL_MSG});
            await secondaryChannel.bindQueue(AGENT_VISUALIZATION_QUEUE, AGENTS_UL_EXCHANGE, "agent.*.visualization");  
            await secondaryChannel.bindQueue(AGENT_VISUALIZATION_QUEUE, AGENT_MQTT_EXCHANGE, "agent.*.visualization");

            await rbmqServices.assertOrSubstituteQueue(secondaryChannel, YARD_VISUALIZATION_QUEUE, false, false, {"x-message-ttl" : TTL_VISUAL_MSG});
            await secondaryChannel.bindQueue(YARD_VISUALIZATION_QUEUE, AGENTS_UL_EXCHANGE, "yard.*.visualization");  
            await secondaryChannel.bindQueue(YARD_VISUALIZATION_QUEUE, AGENT_MQTT_EXCHANGE, "yard.*.visualization");  

            await rbmqServices.assertOrSubstituteQueue(mainChannel, AGENT_STATE_QUEUE, false, true, {"x-message-ttl" : TTL_STATE_MSG});
            await mainChannel.bindQueue(AGENT_STATE_QUEUE, AGENTS_UL_EXCHANGE, "agent.*.state" );         
            await mainChannel.bindQueue(AGENT_STATE_QUEUE, AGENT_MQTT_EXCHANGE, "agent.*.state" ); 

            await rbmqServices.assertOrSubstituteQueue(mainChannel, AGENT_MISSION_QUEUE, false, true);
            await mainChannel.bindQueue(AGENT_MISSION_QUEUE, AGENTS_UL_EXCHANGE, "agent.*.mission_req" );   
            await mainChannel.bindQueue(AGENT_MISSION_QUEUE, AGENT_MQTT_EXCHANGE, "agent.*.mission_req" );  

            await mainChannel.bindQueue(CHECK_IN_QUEUE, AGENTS_UL_EXCHANGE, "agent.*.checkin" );
            await mainChannel.bindQueue(CHECK_IN_QUEUE, AGENT_MQTT_EXCHANGE, "agent.*.checkin" );

            await rbmqServices.assertOrSubstituteQueue(mainChannel, SUMMARY_REQUESTS_QUEUE, false, true);
            await mainChannel.bindQueue(SUMMARY_REQUESTS_QUEUE, AGENTS_UL_EXCHANGE, "*.*.database_req");
            await mainChannel.bindQueue(SUMMARY_REQUESTS_QUEUE, AGENTS_UL_EXCHANGE, "*.*.summary_req");
            await mainChannel.bindQueue(SUMMARY_REQUESTS_QUEUE, AGENTS_UL_EXCHANGE, "*.*.summary");  // MAGPIE COMPATIBLE
            console.log("===> RabbitMQ Schema Completed");

            return dataChannels;
}


    function helyosConsumingMessages (dataChannels) {
        const mainChannel = dataChannels[0];
        const secondaryChannel = dataChannels[1];
        console.log(`\n ================================================================`+
                    `\n ================= SUBSCRIBE TO HELYOS' QUEUES ==================`+
                    `\n ================================================================`);

        mainChannel.consume(CHECK_IN_QUEUE, (message)   => handleBrokerMessages(CHECK_IN_QUEUE, message), { noAck: true});
        mainChannel.consume(AGENT_STATE_QUEUE, (message) => handleBrokerMessages(AGENT_STATE_QUEUE, message), { noAck: true});
        mainChannel.consume(AGENT_UPDATE_QUEUE, (message) => handleBrokerMessages(AGENT_UPDATE_QUEUE, message), { noAck: true});
        mainChannel.consume(AGENT_MISSION_QUEUE, (message) => handleBrokerMessages(AGENT_MISSION_QUEUE, message), { noAck: true});
        secondaryChannel.consume(AGENT_VISUALIZATION_QUEUE, (message) => handleBrokerMessages(AGENT_VISUALIZATION_QUEUE, message), { noAck: true});
        secondaryChannel.consume(YARD_VISUALIZATION_QUEUE, (message) => handleBrokerMessages(YARD_VISUALIZATION_QUEUE, message), { noAck: true});


        mainChannel.consume(SUMMARY_REQUESTS_QUEUE, (message) => handleBrokerMessages(SUMMARY_REQUESTS_QUEUE, message), { noAck: true});
        return dataChannels;
    }


module.exports.initWatchers = initWatchers;
module.exports.initializeRabbitMQAccounts = initializeRabbitMQAccounts;
module.exports.setInitialDatabaseData = setInitialDatabaseData;
module.exports.configureRabbitMQSchema = configureRabbitMQSchema;
module.exports.helyosConsumingMessages = helyosConsumingMessages;

