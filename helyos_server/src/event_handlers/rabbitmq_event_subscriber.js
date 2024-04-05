const databaseServices = require('../services/database/database_services.js');
const { inMemDB, DataRetriever } = require('../services/in_mem_database/mem_database_service.js');
const { AGENT_MQTT_EXCHANGE, AGENTS_DL_EXCHANGE, CHECK_IN_QUEUE, AGENT_MISSION_QUEUE, SUMMARY_REQUESTS_QUEUE, YARD_VISUALIZATION_QUEUE,
        AGENT_UPDATE_QUEUE, AGENT_STATE_QUEUE, AGENT_VISUALIZATION_QUEUE, verifyMessageSignature } = require('../services/message_broker/rabbitMQ_services.js');
const {agentAutoUpdate} = require('./rabbitmq_event_handlers/update_event_handler');
const {yardAutoUpdate} = require('./rabbitmq_event_handlers/yard_update_event_handler');
const {agentCheckIn} = require('./rabbitmq_event_handlers/checkin_event_handler');
const {updateState} = require('./rabbitmq_event_handlers/status_event_handler');
const {saveLogData} = require('../modules/systemlog.js');
const {queryDataBase} = require('./rabbitmq_event_handlers/database_request_handler');
const { deleteConnections } = require('../services/message_broker/rabbitMQ_access_layer.js');

const AGENT_AUTO_REGISTER_TOKEN = process.env.AGENT_AUTO_REGISTER_TOKEN || '0000-0000-0000-0000-0000';
const AGENT_REGISTRATION_TOKEN = process.env.AGENT_AUTO_REGISTER_TOKEN || AGENT_AUTO_REGISTER_TOKEN;
const MESSAGE_RATE_LIMIT = process.env.MESSAGE_RATE_LIMIT || 150;
const MESSAGE_UPDATE_LIMIT = process.env.MESSAGE_UPDATE_LIMIT || 20;
const {MISSION_STATUS } = require('../modules/data_models.js');

/**
 * Parses the message content and returns the object.
 * @param {*} message 
 * @returns 
 * - obj: the parsed object
 * - message: the string message
 * - signature: the signature string
 */
function parseMessage(message) {
    const msgString = message.toString()
    parsedData = JSON.parse(msgString);
    try{
        if(parsedData.message) {
            try {
                return {'obj': JSON.parse(parsedData.message), 'message':parsedData.message,  'signature':parsedData.signature,
                         'headers': parsedData.headers};    
            } catch (error) {
                return  {'obj': parsedData.message, 'message':parsedData.message, 'signature':parsedData.signature,
                        'headers': parsedData.headers};    

            }
        } else {
            return {'obj': parsedData, 'message':msgString, signature:null};
        }
    } catch{
        return {'obj': msgString,  'message': msgString, signature:null};
    }
}

                                    

const isAgentLeader = (leaderUUID, followerUUID) => { 
        return databaseServices.agents.get('uuid', leaderUUID, ['id', 'uuid'], null, ['interconnections'] )
        .then(leader => leader[0].interconnections.some(t => t.uuid === followerUUID));
}

function identifyMessageSender(objMsg, routingKey) {
    // 1st option: search uuid in message. 2nd option: search uuid in the routing key
    let uuid = objMsg && objMsg.obj['uuid'];
    if (!uuid && routingKey.startsWith('agent')) {
        try {
            uuid = routingKey.split('.').reverse()[1];
            if (!uuid){
                throw Error(`UUID code is not present in the routing-key, topic or message`);
            }
        } catch (error) {
            saveLogData('agent', objMsg, 'warn', `error in parsing the UUID from routing-key: ${routingKey}`);
            throw ({msg:`UUID code is not present in the routing-key, topic or message`, code: 'AGENT-400'});
        }
    }

    return uuid;
}


async function validateMessageSender(registeredAgent, uuid, objMsg, msgProps, exchange) {

            if ( registeredAgent.protocol === 'AMQP' && exchange === AGENT_MQTT_EXCHANGE ) {
                throw ({msg:`Wrong protocol; agent is registered as AMQP; ${uuid}`, code: 'AGENT-400'});
            }

            // Sender validation performed in message broker (only available in AMQP protocol)
            if (registeredAgent.protocol === 'AMQP') {  

                const agentAccount = msgProps['userId'];
                const isAnonymousConnection = agentAccount == 'anonymous';
                const hasValidAgentRbmqAccount = (agentAccount === uuid) || isAnonymousConnection;
            
                if (!hasValidAgentRbmqAccount) {
                    // Check if the account belongs to the agent leader. E.g. trailer(follower)=>truck(leader)
                    const possibleLeaderUUID = agentAccount; // The account is possibly from the leader.
                    if (possibleLeaderUUID !== registeredAgent.rbmq_username) {
                        if (await isAgentLeader(possibleLeaderUUID, uuid)) { // May be is the leader account but not registered yet at the agent.
                            console.log(`Agent ${uuid} is using the leader account ${possibleLeaderUUID}`);
                            inMemDB.update('agents', 'uuid', {uuid, rbmq_username:possibleLeaderUUID}, new Date(), 'realtime');
                        } else { // OK, we did our best to validate you and you will be disconnected.
                            saveLogData('agent', {uuid}, 'error', `Agent disconnected: RabbitMQ username ${agentAccount} does not match agent uuid or agent leader!`)
                            deleteConnections(agentAccount);
                            inMemDB.delete('agents', 'uuid', uuid);
                            inMemDB.delete('agents', 'uuid', agentAccount);
                            throw Error(`RabbitMQ username ${agentAccount} does not match agent uuid or agent leader!`);
                        }
                    }
                }
            }

            // Sender validatation using SHA256 signature.
            if(registeredAgent.verify_signature){
                if(objMsg.signature && registeredAgent.public_key ){ 
                    if (!verifyMessageSignature(objMsg.message, registeredAgent.public_key, objMsg.signature)){
                        deleteConnections(uuid);
                        throw ({msg:`Agent signature failed; ${uuid}`, code: 'AGENT-403'});
                    }
                } else {    
                    deleteConnections(uuid);
                    throw ({msg:`signature or public key-absent; ${uuid}`, code: 'AGENT-403'});
                }
            }
}


// agentDataRetriver is used to retrieve data from the database or mem-database.
const SECURITY_FIELDS = ['id', 'uuid', 'protocol', 'rbmq_username',
                         'allow_anonymous_checkin', 'public_key', 'verify_signature'];

const agentDataRetriever = new DataRetriever(inMemDB, databaseServices, 'agents', SECURITY_FIELDS);

/**
 * That is the main function of this module.
 * it handles the messages received from the message broker.
 * @param {string} channelOrQueue - The name of the channel or queue.
 * @param {Object} message - The message object.
 * @returns {Promise} A promise that resolves after the message is processed.
 * 
 * @description
 * The message broker is used for communication between the agents and the server.
 * The agents send messages to the server using the following routing keys:
 * - agent.{uuid}.update
 * - agent.{uuid}.state
 * - agent.{uuid}.database_req
 * - agent.{uuid}.visualization
 * - agent.{uuid}.mission
 * 
 * The function identifies the sender of the message using the uuid code.
 * And, if required, verifies the signature of the message.
 * 
 **/
function handleBrokerMessages(channelOrQueue, message)   {
    let objMsg;
    const content = message.content;
    if (!content) return;
    let msgProps = message.properties;
    const exchange = message.fields.exchange;
    const routingKey  = message.fields.routingKey;

    try {
        objMsg = parseMessage(content);
    } catch (error) {
        saveLogData('agent', {}, 'error', `agent message to ${routingKey} is not a valid JSON`);
        return;
    }

    if (objMsg.headers) {
        msgProps = objMsg.headers;
    }

// IDENTIFY THE SENDER
    const uuid = identifyMessageSender(objMsg, routingKey);
    const agentAccount = msgProps['userId'] || uuid;
    const isAnonymousConnection = msgProps['userId'] == 'anonymous';

    ( async () => {

// VALIDATE MESSAGE SENDER
        let registeredAgent = await agentDataRetriever.getData(uuid);
        
        if (!registeredAgent && channelOrQueue !== CHECK_IN_QUEUE) {
            throw ({msg:`Agent is not registered; ${uuid}`, code: 'AGENT-404'});
        }

        if (registeredAgent) {
            await validateMessageSender(registeredAgent, uuid, objMsg, msgProps, exchange);
        }

// CHECK-IN 
        if (channelOrQueue == CHECK_IN_QUEUE) {
            let checkinData = objMsg.obj.body? objMsg.obj.body : objMsg.obj; // compatibility for agent versions < 2.0

            // SPECIAL CASE: CHECK-IN IS USED FOR CREATING REGISTRATION OR CHANGING REGISTRATION
            if ( !registeredAgent && checkinData['registration_token'] !== AGENT_REGISTRATION_TOKEN) {
                throw ({msg:`Agent is not registered; ${uuid} and registration token is invalid`, code: 'AGENT-404'});
            }   
            if (registeredAgent &&  isAnonymousConnection ) {
                registeredAgent = await agentDataRetriever.getData(uuid, 'uuid', true);
                if(!registeredAgent['allow_anonymous_checkin']){
                    throw ({msg:`Anonymous check-in is not enabled for this agent.; ${uuid}`, code: 'AGENT-403'});
                }
            }
            
            saveLogData('agent', objMsg.obj, 'normal', `agent trying to check in ${message.content.toString()}`);
            const replyExchange = exchange === AGENT_MQTT_EXCHANGE? AGENT_MQTT_EXCHANGE : AGENTS_DL_EXCHANGE;
            return agentCheckIn(uuid, objMsg.obj, msgProps, registeredAgent, replyExchange)
                    .then(( ) =>  saveLogData('agent', objMsg.obj, 'normal', `agent checked in ${message.content.toString()}`))
                    .catch( err => {
                        console.log('checkin:', err);
                        saveLogData('agent', objMsg.obj, 'error', `agent failed to check in ${err.message} ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
                    });
        }



    // SENDER IS INDENTIFIED, CHECKED-IN, REGISTERED AND VALIDATED, LET'S NOW PROCESS THE MESSAGE...

        // Check if the agent is sending too many messages per second.
        inMemDB.agents_stats[uuid]['msgPerSecond'].countMessage();
        const avgRates = inMemDB.getHistoricalCountRateAverage('agents', uuid, 20);
        let closeConnection = false;
        
        if (avgRates.avgMsgPerSecond > MESSAGE_RATE_LIMIT ) {
            saveLogData('agent', {uuid}, 'error', `Agent disconnected: high number of messages per second: ${avgRates.avgMsgPerSecond}. LIMIT: ${MESSAGE_RATE_LIMIT}.`);
            closeConnection = true;
        }

        if (avgRates.avgUpdtPerSecond > MESSAGE_UPDATE_LIMIT) {
            saveLogData('agent', {uuid}, 'error', `Agent disconnected: high db updates per second. Check the publish
                                                 rate for agent.{uuid}.update, agent.{uuid}.state, agent.{uuid}.database_req routes`);
            closeConnection = true;
        }

        if (closeConnection) {
            deleteConnections(agentAccount);
            inMemDB.delete('agents', 'uuid', uuid);
            inMemDB.delete('agents', 'uuid', agentAccount);
            return;
        }

        try {
            switch (channelOrQueue) {
                
                    case SUMMARY_REQUESTS_QUEUE:
                        console.log('SUMMARY_REQUESTS_QUEUE')

                        if (objMsg.obj.body){
                            return queryDataBase(uuid, objMsg.obj, msgProps);
                        } else {
                            saveLogData('agent', objMsg.obj, 'error', `agent data rquest: input body not found`);
                        }
                    break;
                    
                    case AGENT_MISSION_QUEUE:
                        if (objMsg.obj.body){
                            const newWProc = {status: MISSION_STATUS.DISPATCHED};
                            databaseServices.work_processes.insert({...objMsg.obj.body, ...newWProc})
                            .then((wpId) => saveLogData('agent', {...objMsg.obj.body, work_process_id: wpId}, 'normal', `agent created a mission: ${wpId}`))
                            .catch(e => saveLogData('agent', objMsg.obj, 'error', `agent create mission=${e}`));
                        } else {
                            saveLogData('agent', objMsg.obj, 'error', `agent create mission: input data not found`);
                        }
                    break;

                    case AGENT_STATE_QUEUE:
                        if (objMsg.obj.body.status) {
                            updateState(objMsg.obj, uuid, 0)
                            .catch(e => {
                                const msg = e.msg? e.msg : e;
                                saveLogData('agent', objMsg.obj, 'error', `agent state update=${msg}`);
                            });
                        } else {
                            saveLogData('agent', {}, 'error', "state update message does not contain agent status.");
                        }
                    break;

                    case AGENT_UPDATE_QUEUE:
                        if (['agent_update', 'agent_sensors'].includes(objMsg.obj.type)) {
                            agentAutoUpdate(objMsg.obj, uuid, 0);
                        }
                        break;

                    case AGENT_VISUALIZATION_QUEUE:
                        if (['agent_update', 'agent_sensors'].includes(objMsg.obj.type)) {
                            agentAutoUpdate(objMsg.obj, uuid, 1000);
                        }
                        break;


                    case YARD_VISUALIZATION_QUEUE:
                            yardAutoUpdate(objMsg.obj, uuid, 1000);
                        break;    

                    default:
                        break
            }

            
        } catch (error) {
            console.log(error);
        }  
    })().catch(error => {
        saveLogData('agent', {uuid}, 'error',  JSON.stringify(error, Object.getOwnPropertyNames(error)));
    });
};


module.exports.handleBrokerMessages = handleBrokerMessages;