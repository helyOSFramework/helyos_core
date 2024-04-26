const util = require('util');
const { logData} = require('./modules/systemlog.js');
const rbmqServices = require('./services/message_broker/rabbitMQ_services.js'); 
const databaseServices = require('./services/database/database_services.js');
const agentComm = require('./modules/communication/agent_communication.js');
const microserviceWatcher = require('./event_handlers/microservice_event_watcher.js')
const fs = require('fs');
const readYML = require('./modules/read_config_yml.js');

const AGENT_IDLE_TIME_OFFLINE = process.env.AGENT_IDLE_TIME_OFFLINE || 10;
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
async function configureRabbitMQSchema(dataChannel) {
            console.log("===> Setting RabbitMQ Schema");
            // SET EXCHANGE ANONYMOUS TO RECEIVE/SEND MESSAGES FROM/TO AGENT
            await dataChannel.assertExchange(ANONYMOUS_EXCHANGE, 'topic', { durable: true });
            await dataChannel.assertQueue(CHECK_IN_QUEUE, {exclusive: false, durable: true } );
            await dataChannel.bindQueue(CHECK_IN_QUEUE, ANONYMOUS_EXCHANGE, "*.*.checkin" );

            // SET EXCHANGE "DOWN LINK" (DL) TO SEND MESSAGES TO AGENT 
            await dataChannel.assertExchange(AGENTS_DL_EXCHANGE, 'topic', { durable: true });

            // SET EXCHANGE "UP LINK" (UL) AND QUEUES TO RECEIVE MESSAGES FROM AGENT
            await dataChannel.assertExchange(AGENTS_UL_EXCHANGE, 'topic', { durable: true });

            // SET EXCHANGE FOR "MQTT" AGENTS AND QUEUES TO RECEIVE AND SEND MESSAGES TO AGENT
            // ONE CANNOT ASCRIBE SEPARATED EXCHANGES FOR UL AND DL WHEN USE MQTT.
            await dataChannel.assertExchange(AGENT_MQTT_EXCHANGE, 'topic', { durable: true });

            await dataChannel.assertQueue(AGENT_UPDATE_QUEUE, {exclusive: false, durable:true, arguments: {"x-message-ttl" : 10000}});
            await dataChannel.bindQueue(AGENT_UPDATE_QUEUE, AGENTS_UL_EXCHANGE, "*.*.update");
            await dataChannel.bindQueue(AGENT_UPDATE_QUEUE, AGENTS_UL_EXCHANGE, "*.*.fact_sheet");     
            await dataChannel.bindQueue(AGENT_UPDATE_QUEUE, AGENT_MQTT_EXCHANGE, "*.*.update");
            await dataChannel.bindQueue(AGENT_UPDATE_QUEUE, AGENT_MQTT_EXCHANGE, "*.*.fact_sheet"); // VDA-5050 COMPATIBLE

            await dataChannel.assertQueue(AGENT_VISUALIZATION_QUEUE, {exclusive: false, durable:false, arguments: {"x-message-ttl" : 10}});
            await dataChannel.bindQueue(AGENT_VISUALIZATION_QUEUE, AGENTS_UL_EXCHANGE, "agent.*.visualization");  
            await dataChannel.bindQueue(AGENT_VISUALIZATION_QUEUE, AGENT_MQTT_EXCHANGE, "agent.*.visualization");  // VDA-5050 COMPATIBLE

            await dataChannel.assertQueue(YARD_VISUALIZATION_QUEUE, {exclusive: false, durable:false, arguments: {"x-message-ttl" : 10}});
            await dataChannel.bindQueue(YARD_VISUALIZATION_QUEUE, AGENTS_UL_EXCHANGE, "yard.*.visualization");  
            await dataChannel.bindQueue(YARD_VISUALIZATION_QUEUE, AGENT_MQTT_EXCHANGE, "yard.*.visualization");  

            await dataChannel.assertQueue(AGENT_STATE_QUEUE, {exclusive: false, durable:true});
            await dataChannel.bindQueue(AGENT_STATE_QUEUE, AGENTS_UL_EXCHANGE, "*.*.state" );         
            await dataChannel.bindQueue(AGENT_STATE_QUEUE, AGENT_MQTT_EXCHANGE, "*.*.state" );         // VDA-5050 COMPATIBLE

            await dataChannel.assertQueue(AGENT_MISSION_QUEUE, {exclusive: false, durable:true});
            await dataChannel.bindQueue(AGENT_MISSION_QUEUE, AGENTS_UL_EXCHANGE, "*.*.mission_req" );   
            await dataChannel.bindQueue(AGENT_MISSION_QUEUE, AGENT_MQTT_EXCHANGE, "*.*.mission_req" );  

            await dataChannel.bindQueue(CHECK_IN_QUEUE, AGENTS_UL_EXCHANGE, "*.*.checkin" );
            await dataChannel.bindQueue(CHECK_IN_QUEUE, AGENT_MQTT_EXCHANGE, "*.*.checkin" );

            await dataChannel.assertQueue(SUMMARY_REQUESTS_QUEUE, {exclusive: false, durable:true});
            await dataChannel.bindQueue(SUMMARY_REQUESTS_QUEUE, AGENTS_UL_EXCHANGE, "*.*.database_req");
            await dataChannel.bindQueue(SUMMARY_REQUESTS_QUEUE, AGENTS_UL_EXCHANGE, "*.*.summary_req");
            await dataChannel.bindQueue(SUMMARY_REQUESTS_QUEUE, AGENTS_UL_EXCHANGE, "*.*.summary");  // MAGPIE COMPATIBLE
            console.log("===> RabbitMQ Schema Completed");

            return dataChannel;
}


    function helyosConsumingMessages (dataChannel) {
        console.log(" ================================================================")
        console.log(" ================= SUBSCRIBE TO HELYOS' QUEUES ==================")
        console.log(" ================================================================")
        dataChannel.consume(CHECK_IN_QUEUE, (message)   => handleBrokerMessages(CHECK_IN_QUEUE, message), { noAck: true});
        dataChannel.consume(AGENT_STATE_QUEUE, (message) => handleBrokerMessages(AGENT_STATE_QUEUE, message), { noAck: true});
        dataChannel.consume(AGENT_UPDATE_QUEUE, (message) => handleBrokerMessages(AGENT_UPDATE_QUEUE, message), { noAck: true});
        dataChannel.consume(AGENT_MISSION_QUEUE, (message) => handleBrokerMessages(AGENT_MISSION_QUEUE, message), { noAck: true});
        dataChannel.consume(AGENT_VISUALIZATION_QUEUE, (message) => handleBrokerMessages(AGENT_VISUALIZATION_QUEUE, message), { noAck: true});
        dataChannel.consume(YARD_VISUALIZATION_QUEUE, (message) => handleBrokerMessages(YARD_VISUALIZATION_QUEUE, message), { noAck: true});


        dataChannel.consume(SUMMARY_REQUESTS_QUEUE, (message) => handleBrokerMessages(SUMMARY_REQUESTS_QUEUE, message), { noAck: true});
        return dataChannel;
    }


module.exports.initWatchers = initWatchers;
module.exports.initializeRabbitMQAccounts = initializeRabbitMQAccounts;
module.exports.setInitialDatabaseData = setInitialDatabaseData;
module.exports.configureRabbitMQSchema = configureRabbitMQSchema;
module.exports.helyosConsumingMessages = helyosConsumingMessages;

