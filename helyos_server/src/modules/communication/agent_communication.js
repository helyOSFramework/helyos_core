// This module is responsible for sending messages to agents.
// It also contains functions to send instant actions to agents, such as reserving, releasing and cancel agents for work processes.

var rabbitMQServices = require('../../services/message_broker/rabbitMQ_services.js');
var databaseServices = require('../../services/database/database_services.js');
const { logData } = require('../systemlog.js');
const { MISSION_STATUS } = require('../data_models.js');
const MESSAGE_VERSION = rabbitMQServices.MESSAGE_VERSION
const BACKWARD_COMPATIBILITY = (process.env.BACKWARD_COMPATIBILITY || 'false') === 'true';
const REFRESH_ONLNE_TIME_PERIOD = 5;

let POSITION_MARGIN;
if (process.env.POSITION_MARGIN)
    POSITION_MARGIN = parseInt(process.env.POSITION_MARGIN)
else
    POSITION_MARGIN = 1;



function watchWhoIsOnline(maxTimeWithoutUpdate) {
    setInterval(() => databaseServices.updateAgentsConnectionStatus(maxTimeWithoutUpdate), REFRESH_ONLNE_TIME_PERIOD * 1000);
    return;
}


async function sendAssignmentToExecuteInAgent(assignment) {
    const uuids = await databaseServices.agents.getUuids([assignment.agent_id]);
    var assignment_obj = {
                            type: 'assignment_execution',
                            uuid: uuids[0],
                            metadata: { id: parseInt(assignment.id, 10), // from current assignment
                                        yard_id: parseInt(assignment.yard_id, 10),
                                        work_process_id: parseInt(assignment.work_process_id, 10),
                                        status: assignment.status, 
                                        start_time_stamp: assignment.start_time_stamp,
                                        context: assignment.context // from previous assignments 
                                    },
                            body: assignment.data,  // from microservice,
                            _version: MESSAGE_VERSION

                        };

    sendEncriptedMsgToAgent(assignment.agent_id, JSON.stringify(assignment.data),'order');
    sendEncriptedMsgToAgent(assignment.agent_id, JSON.stringify(assignment_obj),'assignment');
}


async function cancelAssignmentInAgent(assignment) {
    const uuids = await databaseServices.agents.getUuids([assignment.agent_id]);
    const assignment_obj = {type: 'assignment_cancel',
                            uuid: uuids[0],
                            metadata: { id: parseInt(assignment.id, 10),
                                        yard_id: parseInt(assignment.yard_id, 10),
                                        work_process_id: parseInt(assignment.work_process_id, 10),
                                        status: assignment.status, 
                                        start_time_stamp: assignment.start_time_stamp,
                                        context: assignment.context // from other assignments 
                                        },
                            body: { assignment_id: assignment.id,
                                    data: {metadata: {type: 'assignment_cancel', 
                                                    custom_meta: assignment.data.metadata, 
                                                    assignment_id: assignment.id}}
                                },
                            _version: MESSAGE_VERSION

                           };

    sendEncriptedMsgToAgent(assignment.agent_id, JSON.stringify(assignment_obj), 'instantActions');
    logData.addLog('agent', {uuid: uuids[0]}, 'info', `Sending cancel signal to agent for the work process ${assignment.work_process_id}`);

}


async function sendCustomInstantActionToAgent(agentId, commandStr) {
    const uuids = await databaseServices.agents.getUuids([agentId]);


    if (!agentId) {
        console.error("no agent id")
    }
    const assignment_obj = {type: 'custom_action',
                            uuid: uuids[0],
                            metadata: {},
                            body: commandStr,
                            _version: MESSAGE_VERSION

                           };


    sendEncriptedMsgToAgent(agentId, JSON.stringify(assignment_obj), 'instantActions');

}

 

/**
 * sendGetReadyForWorkProcessRequest
 * @param {number[]} agentIdList The list of agents to be reserved for the work process
 * @param {number} wpId Work process id.
 * @returns 
 * @description
 * This function sends an instant action to the agents to reserve them for a work process.
 * Agent does whatever it needs to get ready for a mission and then updates status ("READY").
 */

async function sendGetReadyForWorkProcessRequest(agentIdList, wpId, operation_types_required=[]) {
    const agents = await databaseServices.agents.list_in('id',agentIdList);
    const msgs = {};

    agents.forEach(agent => {
         msgs[agent.id] = JSON.stringify({
                            type: 'reserve_for_mission',
                            uuid: agent.uuid,
                            body: {
                                operation_types_required: operation_types_required,
                                work_process_id: parseInt(wpId, 10),
                                reserved: true, 
                            },
                            _version: MESSAGE_VERSION
                        })
    });
    

    return Promise.all(agents.map(agent => {   
        sendEncriptedMsgToAgent(agent.id, msgs[agent.id], 'reserve');
        logData.addLog('agent', {uuid: agent.uuid}, 'info', `Sending reserve signal to agent ${agent.id} for the work process ${wpId}`);
    }));
}

async function sendReleaseFromWorkProcessRequest(agentId, wpId) {
    const uuids = await databaseServices.agents.getUuids([agentId]);

    msg = JSON.stringify({
        type: 'release_from_mission',
        uuid: uuids[0],
        body: {
            work_process_id: parseInt(wpId, 10),
            operation_types_required: [], // to be used in the future
            reserved: false
        },
        _version: MESSAGE_VERSION

    });
    sendEncriptedMsgToAgent(agentId, msg, 'release');
    logData.addLog('agent', {uuid: uuids[0]}, 'info', `Sending release signal to agent ${agentId} for the work process ${wpId}`); 
}


function waitAgentStatusForWorkProcess(agentIds, status, wpId, timeout=20000) {
    const timeStep = 1000;
    let enlapsedTime = 0;

    const checkAgentClearence = (id) => databaseServices.agents.get_byId(id)
        .then(agent => {
            if (!agent) {
                return {error:`the agent id ${id} could not be found in the database.`}
            }
            const agentCurrentResources = agent.resources? agent.resources: agent.wp_clearance
            
            if (agent.status && agent.status.toUpperCase() === status.toUpperCase()) {
                if (!wpId) {
                    return {};
                } else if (agentCurrentResources && (agentCurrentResources.wp_id == wpId || agentCurrentResources.work_process_id == wpId)) {
                    return (agentCurrentResources);
                } else {
                    return null;
                }
            }
            console.log("Wating agent be ", status);
            console.log("===============================================")
            console.log(agent.status, status.toUpperCase())
            console.log("===============================================")

            return null;
        });


    const waitPromise = new Promise((resolve, reject) => {

        const watcher = setInterval(() => {
            enlapsedTime = enlapsedTime + timeStep;
            console.log('Waiting agent status. Time:', enlapsedTime);
            const promiseArray = agentIds.map(agentId => checkAgentClearence(parseInt(agentId)));

            const promises = databaseServices.work_processes.get_byId(wpId, ['status'])
                            .then(wp => {    
                                if (wp && [MISSION_STATUS.CANCELED, MISSION_STATUS.FAILED].includes(wp.status)) return 'WORK_PROCESS_TERMINATED';
                                else return Promise.all(promiseArray);
                            });

            promises.then( values => {

                if (values == 'WORK_PROCESS_TERMINATED') {
                    clearInterval(watcher);
                    reject(new Error(`Work process was terminated ${wpId}`));
                }

                if (values.every(value => value != null)) {
                    const checkForErrors = values.filter(v => (v!==undefined? v.error:false)).map(v=> v.error);
                    if (checkForErrors.length) {
                        const errorMsgs = checkForErrors.join('\n');
                        reject(new Error(`WorkProcess ${wpId} | ${errorMsgs} `));
                    }
                    clearInterval(watcher);
                    resolve(values);
                }
                if (enlapsedTime > timeout) {
                    clearInterval(watcher);
                    reject(new Error(`Timeout: expected ${status} | WorkProcess ${wpId}`));
                }
            });
        }, timeStep);

    });


    return waitPromise;
}


function sendEncriptedMsgToAgent(agentId, message, reason='assignment') {
    console.log(`send message to agent ${agentId} via rabbitmq:`, reason);
    return databaseServices.agents.get_byId(agentId)
           .then(agent => {
            if (!agent) {
                logData.addLog('helyos_core', null, 'error', `Msg ${reason} Agent ${agentId} not found in database`);
                return;
            }
            let exchange = rabbitMQServices.AGENTS_DL_EXCHANGE; 

            if (BACKWARD_COMPATIBILITY)
                rabbitMQServices.sendEncriptedMsg(agent.message_channel, message, agent.public_key);

            if (agent.protocol === 'MQTT'){
                exchange = rabbitMQServices.AGENT_MQTT_EXCHANGE;
            }

            switch (reason) {
                case 'assignment':
                    rabbitMQServices.sendEncriptedMsg(null, message, agent.public_key, `agent.${agent.uuid}.assignment`, exchange);
                    break;

                case 'order':
                    rabbitMQServices.sendEncriptedMsg(null, message, agent.public_key, `agent.${agent.uuid}.order`, exchange);  // VDA-5050 Compatible
                    break;

                case 'instantActions':
                    rabbitMQServices.sendEncriptedMsg(null, message, agent.public_key, `agent.${agent.uuid}.instantActions`,exchange);  // helyOS & VDA-5050 Compatible
                    break;

                case 'reserve':
                    rabbitMQServices.sendEncriptedMsg(null, message, agent.public_key, `agent.${agent.uuid}.instantActions`,exchange);  
                    break;
                
                case 'release':
                    rabbitMQServices.sendEncriptedMsg(null, message, agent.public_key, `agent.${agent.uuid}.instantActions`,exchange);  
                    break;    

                case 'cancel':
                    rabbitMQServices.sendEncriptedMsg(null, message, agent.public_key, `agent.${agent.uuid}.instantActions`,exchange);  
                    break;   
            
                default:
                    break;
            }

        })
}




module.exports.watchWhoIsOnline = watchWhoIsOnline;
module.exports.sendEncriptedMsgToAgent = sendEncriptedMsgToAgent;
module.exports.POSITION_MARGIN = POSITION_MARGIN;
module.exports.sendGetReadyForWorkProcessRequest = sendGetReadyForWorkProcessRequest;
module.exports.waitAgentStatusForWorkProcess = waitAgentStatusForWorkProcess;
module.exports.sendReleaseFromWorkProcessRequest = sendReleaseFromWorkProcessRequest;
module.exports.sendCustomInstantActionToAgent = sendCustomInstantActionToAgent;
module.exports.sendAssignmentToExecuteInAgent = sendAssignmentToExecuteInAgent;
module.exports.cancelAssignmentInAgent = cancelAssignmentInAgent;

