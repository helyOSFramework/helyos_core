const databaseServices = require('../services/database/database_services.js');
const memDBService = require('../services/in_mem_database/mem_database_service.js');
const { AGENT_MQTT_EXCHANGE, AGENTS_DL_EXCHANGE, CHECK_IN_QUEUE, AGENT_MISSION_QUEUE, SUMMARY_REQUESTS_QUEUE, YARD_VISUALIZATION_QUEUE,
        AGENT_UPDATE_QUEUE, AGENT_STATE_QUEUE, AGENT_VISUALIZATION_QUEUE, verifyMessageSignature } = require('../services/message_broker/rabbitMQ_services.js');
const {agentAutoUpdate} = require('./rabbitmq_event_handlers/update_event_handler');
const {yardAutoUpdate} = require('./rabbitmq_event_handlers/yard_update_event_handler');
const {agentCheckIn} = require('./rabbitmq_event_handlers/checkin_event_handler');
const {updateState} = require('./rabbitmq_event_handlers/status_event_handler');
const { logData} = require('../modules/systemlog.js');
const {queryDataBase} = require('./rabbitmq_event_handlers/database_request_handler');
const { deleteConnections } = require('../services/message_broker/rabbitMQ_access_layer.js');

const AGENT_AUTO_REGISTER_TOKEN = process.env.AGENT_AUTO_REGISTER_TOKEN;
const AGENT_REGISTRATION_TOKEN = process.env.AGENT_REGISTRATION_TOKEN || AGENT_AUTO_REGISTER_TOKEN;
const MESSAGE_RATE_LIMIT = parseInt(process.env.MESSAGE_RATE_LIMIT || 150);
const MESSAGE_UPDATE_LIMIT = parseInt(process.env.MESSAGE_UPDATE_LIMIT || 20);
const DB_BUFFER_TIME = parseInt(process.env.DB_BUFFER_TIME || 1000);
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
        return databaseServices.agents.get('uuid', leaderUUID, ['id', 'uuid'], null, ['follower_connections'] )
    .then(leader => {
        if (leader.length === 0) {
            logData.addLog('agent', {uuid: leaderUUID}, 'error', `Agent cannot be found in the database: ${leaderUUID}`);
            return false;
        }
        return leader[0].follower_connections.some(t => t.uuid === followerUUID)
    })
}

function identifyMessageSender(objMsg, routingKey) {
    // 1st option: search uuid in message. 2nd option: search uuid in the routing key
    let uuid = objMsg && objMsg.obj['uuid'];
    if (!uuid && (routingKey.startsWith('agent.') || routingKey.startsWith('yard.')) ) {
        try {
            uuid = routingKey.split('.').reverse()[1];
            if (!uuid){
                throw Error(`UUID code is not present in the routing-key, topic or message`);
            }
        } catch (error) {
            logData.addLog('agent', objMsg, 'warn', `error in parsing the UUID from routing-key: ${routingKey}`);
            throw ({msg:`UUID code is not present in the routing-key, topic or message`, code: 'AGENT-400'});
        }
    }

    return uuid;
}


async function validateMessageSender(inMemDB, registeredAgent, uuid, objMsg, msgProps, exchange) {

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
                            inMemDB.update('agents', 'uuid', {uuid, rbmq_username:possibleLeaderUUID}, new Date(), 'realtime',  0, databaseServices.agents);
                        } else { // OK, we did our best to validate you and you will be disconnected.
                            logData.addLog('agent', {uuid}, 'error', 
                                `helyOS disconnected the agent: An agent is trying to publish a message for another agent.` + 
                                `For interconnected agents, the RabbitMQ username ${agentAccount} should match the leader's UUID.`)
                            inMemDB.delete('agents', 'uuid', uuid);
                            inMemDB.delete('agents', 'uuid', agentAccount);
                            deleteConnections(agentAccount);
                            throw Error(`RabbitMQ username ${agentAccount} does not match either the agent's UUID or its leader's UUID.`);
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
                    throw ({msg:`Signature or public key-absent; ${uuid}`, code: 'AGENT-403'});
                }
            }
}


function validateAnonymousCheckin(registeredAgent, checkinData) {

    const errorMsg = registeredAgent? `Agent registered, logged as anonymous` : `Agent not registered, logged as anonymous`;
    const errorCode = registeredAgent? 'AGENT-403' : 'AGENT-404';

    if (!checkinData['registration_token'] ) {
        throw ({
            msg: `${errorMsg}, No "registration_token" provided by agent during check-in.`,
            code: errorCode
        });
    }

    if (!AGENT_REGISTRATION_TOKEN) {
        throw ({
            msg:`${errorMsg}, AGENT_REGISTRATION_TOKEN was not set in this helyOS server.`, 
            code: errorCode
        });
    }

    if (checkinData['registration_token'] !== AGENT_REGISTRATION_TOKEN) {
        throw ({
            msg:`${errorMsg}, Agent's registration_token is invalid`, 
            code: errorCode
        });
    }   
}


// agentDataRetriver is used to retrieve data from the database or mem-database.
const SECURITY_FIELDS = ['id', 'uuid', 'protocol', 'rbmq_username',
                         'allow_anonymous_checkin', 'public_key', 'verify_signature'];


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
        logData.addLog('agent', {}, 'error', `agent message to ${routingKey} is not a valid JSON`);
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

        const inMemDB = await memDBService.getInstance();
        const agentDataRetriever =  memDBService.DataRetriever.getInstance(inMemDB, databaseServices, 'agents', SECURITY_FIELDS);

// VALIDATE MESSAGE SENDER
        let registeredAgent = await agentDataRetriever.getData(uuid);
        
        if (!registeredAgent && channelOrQueue !== CHECK_IN_QUEUE) {
            throw ({msg:`Agent is not registered; ${uuid}`, code: 'AGENT-404'});
        }

        if (registeredAgent) {
            await validateMessageSender(inMemDB,registeredAgent, uuid, objMsg, msgProps, exchange);
        }

// CHECK-IN 
        if (channelOrQueue == CHECK_IN_QUEUE) {
            let checkinData = objMsg.obj.body? objMsg.obj.body : objMsg.obj; // compatibility for agent versions < 2.0

            if (!registeredAgent){
                validateAnonymousCheckin(registeredAgent, checkinData);

            } else {
                if (isAnonymousConnection) {
                        registeredAgent = await agentDataRetriever.getData(uuid, 'uuid', true);
                        if(!registeredAgent['allow_anonymous_checkin']){
                            throw ({msg:`Anonymous check-in is not enabled for this agent.; ${uuid}`, code: 'AGENT-403'});
                        }
                        validateAnonymousCheckin(registeredAgent, checkinData);
                }
            }
            
            logData.addLog('agent', checkinData, 'normal', `agent trying to check in. UUID:${uuid} Anonymous:${isAnonymousConnection}`);
            const replyExchange = exchange === AGENT_MQTT_EXCHANGE? AGENT_MQTT_EXCHANGE : AGENTS_DL_EXCHANGE;
            return agentCheckIn(uuid, objMsg.obj, msgProps, registeredAgent, replyExchange)
                    .then((agent) =>  logData.addLog('agent', objMsg.obj, 'normal', `${uuid}-${agent?.name} agent checked in`))
                    .catch( err => {
                        console.error('checkin:', err);
                        logData.addLog('agent', objMsg.obj, 'error', `agent failed to check in ${err.message} ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
                    });
        }



    // SENDER IS INDENTIFIED, CHECKED-IN, REGISTERED AND VALIDATED, LET'S NOW PROCESS THE MESSAGE...

        // Check if the agent is sending too many messages per second.
        if (inMemDB.agents_stats[uuid]) {
            inMemDB.agents_stats[uuid]['msgPerSecond'].countMessage();
        }
        const avgRates = inMemDB.getHistoricalCountRateAverage('agents', uuid, 20);
        let closeConnection = false;
        
        if (avgRates.avgMsgPerSecond > MESSAGE_RATE_LIMIT ) {
            logData.addLog('agent', {uuid}, 'error', `Agent disconnected: high number of messages per second: ${avgRates.avgMsgPerSecond}. LIMIT: ${MESSAGE_RATE_LIMIT}.`);
            closeConnection = true;
        }

        if (avgRates.avgUpdtPerSecond > MESSAGE_UPDATE_LIMIT) {
            logData.addLog('agent', {uuid}, 'error',
                            `Agent disconnected: high number of database updates per second (MESSAGE_UPDATE_LIMIT=${MESSAGE_UPDATE_LIMIT}). Please check the publish rate for the routes agent.${uuid}.update, agent.${uuid}.state, and agent.${uuid}.database_req.`);
            
            closeConnection = true;
        }

        if (closeConnection) {
            inMemDB.delete('agents', 'uuid', uuid);
            inMemDB.delete('agents', 'uuid', agentAccount);
            deleteConnections(agentAccount).catch(e => console.error(e));
            return;
        }

        try {
            switch (channelOrQueue) {
                
                    case SUMMARY_REQUESTS_QUEUE:
                        if (objMsg.obj.body){
                            return queryDataBase(uuid, objMsg.obj, msgProps);
                        } else {
                            logData.addLog('agent', objMsg.obj, 'error', `agent data request: input body not found`);
                        }
                    break;
                    
                    case AGENT_MISSION_QUEUE:
                        if (objMsg.obj.body){
                            const newWProc = {status: MISSION_STATUS.DISPATCHED};
                            databaseServices.work_processes.insert({...objMsg.obj.body, ...newWProc})
                            .then((wpId) => logData.addLog('agent', {...objMsg.obj.body, work_process_id: wpId}, 'normal', `agent created a mission: ${wpId}`))
                            .catch(e => logData.addLog('agent', objMsg.obj, 'error', `agent create mission=${e}`));
                        } else {
                            logData.addLog('agent', objMsg.obj, 'error', `agent create mission: input data not found`);
                        }
                    break;

                    case AGENT_STATE_QUEUE:
                        if (objMsg.obj.body.status) {
                            updateState(objMsg.obj, uuid, 0)
                            .catch(e => {
                                const msg = e.message? e.message : e;
                                logData.addLog('agent', objMsg.obj, 'error', `agent state update: ${msg}`);
                            });
                        } else {
                            logData.addLog('agent', {}, 'error', "state update message does not contain agent status.");
                        }
                    break;

                    case AGENT_UPDATE_QUEUE:
                        if (['agent_update', 'agent_sensors'].includes(objMsg.obj.type)) {
                            agentAutoUpdate(objMsg.obj, uuid, 0);
                        }
                        break;

                    case AGENT_VISUALIZATION_QUEUE:
                        if (['agent_update', 'agent_sensors'].includes(objMsg.obj.type)) {
                            agentAutoUpdate(objMsg.obj, uuid, DB_BUFFER_TIME);
                        }
                        break;


                    case YARD_VISUALIZATION_QUEUE:
                            yardAutoUpdate(objMsg.obj, uuid, DB_BUFFER_TIME);
                        break;    

                    default:
                        break
            }

            
        } catch (error) {
            console.log(error);
        }  
    })().catch(error => {
        const errorMsg = error.message?  {message:error.message} : error;
        console.error('Stack trace', error.stack);
        logData.addLog('agent', {uuid}, 'error',  JSON.stringify(errorMsg, Object.getOwnPropertyNames(errorMsg)));
    });
};


module.exports.handleBrokerMessages = handleBrokerMessages;