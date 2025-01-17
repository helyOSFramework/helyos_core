import databaseServices from '../services/database/database_services';
import * as memDBService from '../services/in_mem_database/mem_database_service';
import RabbitMQServices  from '../services/message_broker/rabbitMQ_services';

import { agentAutoUpdate } from './rabbitmq_event_handlers/update_event_handler';
import { yardAutoUpdate } from './rabbitmq_event_handlers/yard_update_event_handler';
import { agentCheckIn } from './rabbitmq_event_handlers/checkin_event_handler';
import { agentCheckOut } from './rabbitmq_event_handlers/checkout_event_handler';
import { updateState } from './rabbitmq_event_handlers/status_event_handler';
import { logData } from '../modules/systemlog';
import { queryDataBase } from './rabbitmq_event_handlers/database_request_handler';

import config from '../config';
const {
    AGENTS_MQTT_EXCHANGE,
    AGENTS_DL_EXCHANGE,
    CHECK_IN_QUEUE,
    AGENT_MISSION_QUEUE,
    SUMMARY_REQUESTS_QUEUE,
    YARD_VISUALIZATION_QUEUE,
    AGENT_UPDATE_QUEUE,
    AGENT_STATE_QUEUE,
    AGENT_VISUALIZATION_QUEUE,
    AGENT_REGISTRATION_TOKEN,
} = config;

import { MISSION_STATUS } from '../modules/data_models';
import { constrainedMemory } from 'process';

interface ParsedMessage {
  obj: any;
  message: string;
  signature: string | null;
  headers?: any; // Only for MQTT agents. The AMQP headers are already included in msgProps.
}

interface RegisteredAgent {
  protocol: string;
  rbmq_username: string;
  verify_signature: boolean;
  public_key?: string;
  allow_anonymous_checkin?: boolean;
}

interface MessageProperties {
  userId?: string;
  [key: string]: any;
}

/**
 * Parses the message content and returns the object.
 * @param {*} message
 * @returns
 * - obj: the parsed object
 * - message: the string message
 * - signature: the signature string
 */
function parseMessage(message: Buffer): ParsedMessage {
    const msgString = message.toString();
    let parsedData;

    try {
        parsedData = JSON.parse(msgString);
        if (parsedData.message) {
            try {
                return {
                    obj: JSON.parse(parsedData.message),
                    message: parsedData.message,
                    signature: parsedData.signature,
                    headers: parsedData.headers,
                };
            } catch (error) {
                return {
                    obj: parsedData.message,
                    message: parsedData.message,
                    signature: parsedData.signature,
                    headers: parsedData.headers,
                };
            }
        } else {
            return {
                obj: parsedData,
                message: msgString,
                signature: null,
            };
        }
    } catch {
        return {
            obj: msgString,
            message: msgString,
            signature: null,
        };
    }
}

const isAgentLeader = async (leaderUUID: string, followerUUID: string): Promise<boolean> => {
    const leader = await databaseServices.agents.get('uuid', leaderUUID,['id', 'uuid'],null, false, ['follower_connections']);

    if (leader.length === 0) {
        logData.addLog('agent', {
            uuid: leaderUUID,
        }, 'error', `Agent cannot be found in the database: ${leaderUUID}`);
        return false;
    }
    return leader[0].follower_connections.some((t) => t.uuid === followerUUID);
};

function identifyMessageSender(objMsg: ParsedMessage, routingKey: string): string {
    let uuid = objMsg?.obj['uuid'];
    if (!uuid && (routingKey.startsWith('agent.') || routingKey.startsWith('yard.'))) {
        try {
            uuid = routingKey.split('.').reverse()[1];
            if (!uuid) {
                throw Error(`UUID code is not present in the routing-key, topic or message`);
            }
        } catch (error) {
            logData.addLog('agent', objMsg, 'warn', `error in parsing the UUID from routing-key: ${routingKey}`);
            throw {
                msg: `UUID code is not present in the routing-key, topic or message`,
                code: 'AGENT-400',
            };
        }
    }

    return uuid;
}

async function validateMessageSender(inMemDB: any,registeredAgent: RegisteredAgent,uuid: string,objMsg: ParsedMessage, msgProps: MessageProperties,exchange: string): Promise<void> {
    if (registeredAgent.protocol === 'AMQP' && exchange === AGENTS_MQTT_EXCHANGE) {
        throw {
            msg: `Wrong protocol; agent is registered as AMQP; ${uuid}`,
            code: 'AGENT-400',
        };
    }

    if (registeredAgent.protocol === 'AMQP') {
        const agentAccount = msgProps['userId'];
        const isAnonymousConnection = agentAccount === 'anonymous';
        const hasValidAgentRbmqAccount = agentAccount === uuid || isAnonymousConnection;

        if (!hasValidAgentRbmqAccount) {
            const possibleLeaderUUID = agentAccount;
            if (possibleLeaderUUID && possibleLeaderUUID !== registeredAgent.rbmq_username) {
                if (await isAgentLeader(possibleLeaderUUID, uuid)) {
                    inMemDB.update('agents', 'uuid', {
                        uuid,
                        rbmq_username: possibleLeaderUUID,
                    }, new Date(), 'realtime', 0, databaseServices.agents);
                } else {
                    logData.addLog('agent', {
                        uuid,
                    }, 'error',
              `helyOS disconnected the agent: An agent is trying to publish a message for another agent.` +
              `For interconnected agents, the RabbitMQ username ${agentAccount} should match the leader's UUID.`);
                    inMemDB.delete('agents', 'uuid', uuid);
                    inMemDB.delete('agents', 'uuid', agentAccount);
                    RabbitMQServices.deleteConnections(agentAccount);
                    throw Error(`RabbitMQ username ${agentAccount} does not match either the agent's UUID or its leader's UUID.`);
                }
            }
        }
    }

    if (registeredAgent.verify_signature) {
        if (objMsg.signature && registeredAgent.public_key) {
            if (!RabbitMQServices.verifyMessageSignature(objMsg.message, registeredAgent.public_key, objMsg.signature)) {
                RabbitMQServices.deleteConnections(uuid);
                throw {
                    msg: `Agent signature failed; ${uuid}`,
                    code: 'AGENT-403',
                };
            }
        } else {
            RabbitMQServices.deleteConnections(uuid);
            throw {
                msg: `Signature or public key-absent; ${uuid}`,
                code: 'AGENT-403',
            };
        }
    }
}

function validateAnonymousCheckin(registeredAgent: RegisteredAgent | null, checkinData: any): void {
    const errorMsg = registeredAgent ? `Agent registered, logged as anonymous` : `Agent not registered, logged as anonymous`;
    const errorCode = registeredAgent ? 'AGENT-403' : 'AGENT-404';

    if (!checkinData['registration_token']) {
        throw {
            msg: `${errorMsg}, No "registration_token" provided by agent during check-in.`,
            code: errorCode,
        };
    }

    if (!AGENT_REGISTRATION_TOKEN) {
        throw {
            msg: `${errorMsg}, AGENT_REGISTRATION_TOKEN was not set in this helyOS server.`,
            code: errorCode,
        };
    }

    if (checkinData['registration_token'] !== AGENT_REGISTRATION_TOKEN) {
        throw {
            msg: `${errorMsg}, Agent's registration_token is invalid`,
            code: errorCode,
        };
    }
}

// agentDataRetriver is used to retrieve data from the database or mem-database.
const SECURITY_FIELDS = ['id',
    'uuid',
    'protocol',
    'rbmq_username',
    'allow_anonymous_checkin',
    'public_key',
    'verify_signature'];

/**
 * That is the main function of this module.
 * it handles the messages received from the message broker.
 * @param {string} queueName - The name of the channel or queue.
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
async function handleBrokerMessages(channel: any, queueName: string, message: any) {
    let objMsg: ParsedMessage;
    const content = message.content;
    if (!content) {
        return;
    }
    let msgProps = message.properties;
    const exchange = message.fields.exchange;
    const routingKey = message.fields.routingKey;

    try {
        objMsg = parseMessage(content);
    } catch (error) {
        logData.addLog('agent', {}, 'error', `agent message to ${routingKey} is not a valid JSON`);
        return;
    }

    if (objMsg.headers) {
        msgProps = objMsg.headers;
    }

    const uuid = identifyMessageSender(objMsg, routingKey);
    const agentAccount = msgProps['userId'] || uuid;
    const isAnonymousConnection = msgProps['userId'] === 'anonymous';

    (async () => {
        const inMemDB = await memDBService.getInstance();
        const agentDataRetriever = memDBService.DataRetriever.getInstance(inMemDB, databaseServices, 'agents', SECURITY_FIELDS);

        let registeredAgent = await agentDataRetriever.getData(uuid);

        if (!registeredAgent && queueName !== CHECK_IN_QUEUE) {
            throw {
                msg: `Agent is not registered; ${uuid}`,
                code: 'AGENT-404',
            };
        }

        if (registeredAgent) {
            await validateMessageSender(inMemDB, registeredAgent, uuid, objMsg, msgProps, exchange);
        }

        if (queueName === CHECK_IN_QUEUE) {
            const checkinData = objMsg.obj.body ? objMsg.obj.body : objMsg.obj;

            if (!registeredAgent) {
                validateAnonymousCheckin(registeredAgent, checkinData);
            } else if (isAnonymousConnection) {
                registeredAgent = await agentDataRetriever.getData(uuid, 'uuid', true);
                if (!registeredAgent['allow_anonymous_checkin']) {
                    throw {
                        msg: `Anonymous check-in is not enabled for this agent.; ${uuid}`,
                        code: 'AGENT-403',
                    };
                }
                validateAnonymousCheckin(registeredAgent, checkinData);
            }

            const replyExchange = exchange === AGENTS_MQTT_EXCHANGE ? AGENTS_MQTT_EXCHANGE : AGENTS_DL_EXCHANGE;

            if (objMsg.obj.type === 'checkout') {
                return agentCheckOut(uuid, objMsg.obj, msgProps, registeredAgent, replyExchange)
                    .then(() => logData.addLog('agent', objMsg.obj, 'info', `${uuid} - agent checked out`))
                    .catch((err) => {
                        logData.addLog('agent', objMsg.obj, 'error', `agent failed to check out ${err.message} ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
                    });
            }

            if (objMsg.obj.type === 'checkin') {
                logData.addLog('agent', checkinData, 'info', `agent trying to check in. UUID:${uuid} Anonymous:${isAnonymousConnection}`);
                return agentCheckIn(uuid, objMsg.obj, msgProps, registeredAgent, replyExchange)
                    .then(() => logData.addLog('agent', objMsg.obj, 'info', `${uuid} - agent checked in`))
                    .catch((err) => {
                        console.error('checkin:', err);
                        logData.addLog('agent', objMsg.obj, 'error', `agent failed to check in ${err.message} ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
                    });
            }
        }

        if (inMemDB.agents_stats[uuid]) {
            inMemDB.countMessages(`agents_stats`, uuid, 'msgPerSecond');
        }

        try {
            switch (queueName) {
                case SUMMARY_REQUESTS_QUEUE:
                    if (objMsg.obj.body) {
                        return queryDataBase(uuid, objMsg.obj, msgProps);
                    } else {
                        logData.addLog('agent', objMsg.obj, 'error', `agent data request: input body not found`);
                    }
                    break;

                case AGENT_MISSION_QUEUE:
                    if (objMsg.obj.body) {
                        const newWProc = {
                            status: MISSION_STATUS.DISPATCHED,
                        };
                        databaseServices.work_processes.insert({
                            ...objMsg.obj.body,
                            ...newWProc,
                        })
                            .then((wpId) => logData.addLog('agent', {
                                ...objMsg.obj.body,
                                work_process_id: wpId,
                            }, 'info', `agent created a mission: ${wpId}`))
                            .catch((e) => logData.addLog('agent', objMsg.obj, 'error', `agent create mission=${e}`));
                    } else {
                        logData.addLog('agent', objMsg.obj, 'error', `agent create mission: input data not found`);
                    }
                    break;

                case AGENT_STATE_QUEUE:
                    if (objMsg.obj.body.status) {
                        updateState(objMsg.obj, uuid, 0)
                            .then(() => channel.ack(message))
                            .catch((e) => {
                                const msg = e.message ? e.message : e;
                                logData.addLog('agent', objMsg.obj, 'error', `agent state update: ${msg}`);
                            });
                    } else {
                        logData.addLog('agent', {}, 'error', "state update message does not contain agent status.");
                    }
                    break;

                case AGENT_UPDATE_QUEUE:
                    if (['agent_update', 'agent_sensors'].includes(objMsg.obj.type)) {
                        agentAutoUpdate(objMsg.obj, uuid, 'realtime')
                            .then(() => channel.ack(message));
                    }
                    break;

                case AGENT_VISUALIZATION_QUEUE:
                    if (['agent_update', 'agent_sensors'].includes(objMsg.obj.type)) {
                        agentAutoUpdate(objMsg.obj, uuid);
                    }
                    break;

                case YARD_VISUALIZATION_QUEUE:
                    yardAutoUpdate(objMsg.obj, uuid);
                    break;

                default:
                    break;
            }
        } catch (error) {
            console.log(error);
        }
    })().catch((error) => {
        const errorMsg = error.message ? {
            message: error.message,
        } : error;
        console.error('Stack trace', error.stack);
        logData.addLog('agent', {
            uuid,
        }, 'error', JSON.stringify(errorMsg, Object.getOwnPropertyNames(errorMsg)));
    });
}

export {
    handleBrokerMessages,
};