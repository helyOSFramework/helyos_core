/// This module is responsible for sending messages to agents.
// It also contains functions to send instant actions to agents, such as reserving, releasing and cancel agents for work processes.

import rabbitMQServices from '../../services/message_broker/rabbitMQ_services';
import databaseServices from '../../services/database/database_services';
import roleManagerModule from '../../role_manager';
import * as memDBService from '../../services/in_mem_database/mem_database_service';

import { logData } from '../systemlog';
import { MISSION_STATUS, AGENT_STATUS } from '../data_models';
const MESSAGE_VERSION  = rabbitMQServices.MESSAGE_VERSION
const REFRESH_ONLINE_TIME_PERIOD = 5;

type Assignment = {
    id: number;
    agent_id: number;
    yard_id: number;
    work_process_id: number;
    status: string;
    start_time_stamp: Date;
    context: any;
    data: any;
};

type Agent = {
    id: number;
    uuid: string;
    protocol: string;
    public_key: string;
    status?: string;
    resources?: any;
    wp_clearance?: any;
};

async function watchWhoIsOnline(maxTimeWithoutUpdate: number): Promise<void> {
    const roleManager = await roleManagerModule.getInstance();

    setInterval(() => {
        if (roleManager.amILeader) {
            databaseServices.updateAgentsConnectionStatus(maxTimeWithoutUpdate);
        }
    }, REFRESH_ONLINE_TIME_PERIOD * 1000);
}

async function watchMessageRates(msgRateLimit: number, updtRateLimit: number): Promise<void> {
    const roleManager = await roleManagerModule.getInstance();
    const inMemDB = await memDBService.getInstance();

    setInterval(async () => {
        if (roleManager.amILeader) {
            const infractors = await databaseServices.getHighMsgRateAgents(msgRateLimit, updtRateLimit);
            const updtInfractors = infractors ? infractors[1] : [];
            const msgInfractors = infractors ? infractors[0] : [];

            const kickOutInfractorAgent = async (agent: Agent, commandStr: string): Promise<void> => {
                try {
                    await sendReduceMsgRateInstantAction(agent, commandStr);
                    await rabbitMQServices.deleteConnections(agent.uuid);
                    await databaseServices.agents.update('uuid', agent.uuid, {
                        connection_status: 'offline',
                        msg_per_sec: 0,
                        updt_per_sec: 0,
                    });
                    await inMemDB.delete('agents', 'uuid', agent.uuid);
                } catch (e) {
                    console.error(e);
                }
            };

            for (const agent of updtInfractors) {
                const commandStr = JSON.stringify({
                    action: 'REDUCE_UPDATE_RATE',
                    parameters: { rate: agent.updt_per_sec, limit: updtRateLimit },
                });
                logData.addLog('agent', { uuid: agent.uuid }, 'error',
                    `Agent disconnected: high number of database updates per second. MESSAGE_UPDATE_LIMIT=${updtRateLimit} Hz. ` +
                    `Please check the publish rate for the routes agent.${agent.uuid}.update, agent.${agent.uuid}.state, and agent.${agent.uuid}.database_req.`);
                await kickOutInfractorAgent(agent, commandStr);
            }

            for (const agent of msgInfractors) {
                const commandStr = JSON.stringify({
                    action: 'REDUCE_MSG_RATE',
                    parameters: { rate: agent.msg_per_sec, limit: msgRateLimit },
                });
                logData.addLog('agent', { uuid: agent.uuid }, 'error',
                    `Agent disconnected: high number of messages per second: ${agent.msg_per_sec}. MESSAGE_RATE_LIMIT=${msgRateLimit} Hz.`);
                await kickOutInfractorAgent(agent, commandStr);
            }
        }
    }, REFRESH_ONLINE_TIME_PERIOD * 1000);
}

async function sendAssignmentToExecuteInAgent(assignment: Assignment): Promise<void> {
    const uuids = await databaseServices.agents.getUuids([assignment.agent_id]);
    const assignmentObj = {
        type: 'assignment_execution',
        uuid: uuids[0],
        metadata: {
            id: assignment.id,
            yard_id: assignment.yard_id,
            work_process_id: assignment.work_process_id,
            status: assignment.status,
            start_time_stamp: assignment.start_time_stamp,
            context: assignment.context,
        },
        body: assignment.data,
        _version: MESSAGE_VERSION,
    };

    await sendEncryptedMsgToAgent(assignment.agent_id, JSON.stringify(assignment.data), 'order');
    await sendEncryptedMsgToAgent(assignment.agent_id, JSON.stringify(assignmentObj), 'assignment');
}

async function cancelAssignmentInAgent(assignment: Assignment): Promise<void> {
    const uuids = await databaseServices.agents.getUuids([assignment.agent_id]);
    const assignmentObj = {
        type: 'assignment_cancel',
        uuid: uuids[0],
        metadata: {
            id: assignment.id,
            yard_id: assignment.yard_id,
            work_process_id: assignment.work_process_id,
            status: assignment.status,
            start_time_stamp: assignment.start_time_stamp,
            context: assignment.context,
        },
        body: {
            assignment_id: assignment.id,
            data: {
                metadata: {
                    type: 'assignment_cancel',
                    custom_meta: assignment.data.metadata,
                    assignment_id: assignment.id,
                },
            },
        },
        _version: MESSAGE_VERSION,
    };

    await sendEncryptedMsgToAgent(assignment.agent_id, JSON.stringify(assignmentObj), 'instantActions');
    logData.addLog('agent', { uuid: uuids[0] }, 'info', `Sending cancel signal to agent for the work process ${assignment.work_process_id}`);
}

async function sendCustomInstantActionToAgent(agentId: number, commandStr: string): Promise<void> {
    const uuids = await databaseServices.agents.getUuids([agentId]);

    if (!agentId) {
        console.error("no agent id");
        return;
    }

    const assignmentObj = {
        type: 'custom_action',
        uuid: uuids[0],
        metadata: {},
        body: commandStr,
        _version: MESSAGE_VERSION,
    };

    await sendEncryptedMsgToAgent(agentId, JSON.stringify(assignmentObj), 'instantActions');
}

async function sendReduceMsgRateInstantAction(agent: Agent, commandStr: string): Promise<void> {
    const assignmentObj = {
        type: 'data_control',
        uuid: agent.uuid,
        metadata: {},
        body: commandStr,
        _version: MESSAGE_VERSION,
    };

    await sendEncryptedMsgToAgent(agent.id, JSON.stringify(assignmentObj), 'instantActions');
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


async function sendGetReadyForWorkProcessRequest(agentIdList: number[], wpId: number, operationTypesRequired: string[] = []): Promise<void[]> {
    const agents = await databaseServices.agents.list_in('id', agentIdList);
    const msgs: Record<number, string> = {};

    for (const agent of agents) {
        msgs[agent.id] = JSON.stringify({
            type: 'reserve_for_mission',
            uuid: agent.uuid,
            body: {
                operation_types_required: operationTypesRequired,
                work_process_id: wpId,
                reserved: true,
            },
            _version: MESSAGE_VERSION,
        });
    }

    return Promise.all(agents.map(agent => {
        logData.addLog('agent', { uuid: agent.uuid }, 'info', `Sending reserve signal to agent ${agent.id} for the work process ${wpId}`);
        return sendEncryptedMsgToAgent(agent.id, msgs[agent.id], 'reserve');
    }));
}

async function sendReleaseFromWorkProcessRequest(agentId: number, wpId: number): Promise<void> {
    const uuids = await databaseServices.agents.getUuids([agentId]);

    const msg = JSON.stringify({
        type: 'release_from_mission',
        uuid: uuids[0],
        body: {
            work_process_id: wpId,
            operation_types_required: [],
            reserved: false,
        },
        _version: MESSAGE_VERSION,
    });
    await sendEncryptedMsgToAgent(agentId, msg, 'release');
    logData.addLog('agent', { uuid: uuids[0] }, 'info', `Sending release signal to agent ${agentId} for the work process ${wpId}`);
}


function waitAgentStatusForWorkProcess(agentIds: number[],status: string, wpId: string | null,timeout: number = 20000): Promise<boolean[]> {
    const timeStep = 1000;
    let elapsedTime = 0;

    if (status.toLowerCase() === AGENT_STATUS.READY.toLowerCase() && !wpId) {
        return Promise.reject(new Error('working process id was not informed for READY status'));
    }

    const checkAgentClearance = (id: number): Promise<boolean | { error: string } | null> =>
        databaseServices.agents.get_byId(id).then((agent) => {
            if (!agent) {
                return { error: `The agent id ${id} could not be found in the database.` };
            }

            if (agent.status && agent.status.toLowerCase() === status.toLowerCase()) {
                if (status.toLowerCase() !== AGENT_STATUS.READY.toLowerCase()) {
                    return true;
                }

                const agentCurrentResources = agent.resources || agent.wp_clearance;
                const reportedWorkProcessId =
                    agentCurrentResources?.work_process_id || agentCurrentResources?.wp_id;

                if (reportedWorkProcessId == wpId) {
                    return true;
                }

                const warnMessage = reportedWorkProcessId
                    ? `Agent ${agent.id} is not ready for the work process wp_id:${wpId}, but to wp_id:${reportedWorkProcessId}`
                    : `Agent ${agent.id} reported "ready" but the work process id is missing. Expected: { status:"ready", resources:{work_process_id: ${wpId}} }`;

                logData.addLog('agent', { uuid: agent.uuid }, 'warn', warnMessage);
                return null;
            }

            console.log(`Waiting for agent to be ${status}`);
            console.log(`===============================================`);
            console.log(agent.status, status.toLowerCase());
            console.log(`===============================================`);

            return null;
        });

    return new Promise((resolve, reject) => {
        const watcher = setInterval(() => {
            elapsedTime += timeStep;
            console.log(`Waiting for agent status ${status}. Time: ${elapsedTime}`);
            const promiseArray = agentIds.map((agentId) => checkAgentClearance(agentId));

            const promises = databaseServices.work_processes.get_byId(wpId!, ['status'])
                            .then((wp) => {
                                if (wp && [MISSION_STATUS.CANCELED, MISSION_STATUS.FAILED].includes(wp.status)) {
                                    return ['WORK_PROCESS_TERMINATED'];
                                }

                                return Promise.all(promiseArray) as Promise<any[]>;
                            });

            promises.then((values: any[]) => {
                if (values.includes('WORK_PROCESS_TERMINATED')) {
                    clearInterval(watcher);
                    reject(new Error(`Work process was terminated ${wpId}`));
                }

                if (values.every((value) => value !== null)) {
                    const errors = values
                        .filter((v) => typeof v === 'object' && (v as { error: string }).error)
                        .map((v) => (v as { error: string }).error);

                    if (errors.length) {
                        clearInterval(watcher);
                        reject(new Error(`WorkProcess ${wpId} | ${errors.join('\n')}`));
                    }
                }

                if (elapsedTime > timeout) {
                    clearInterval(watcher);
                    reject(new Error(`Timeout: expected ${status} | WorkProcess ${wpId}`));
                }

                if (values.every((value) => value === true)) {
                    clearInterval(watcher);
                    resolve(values as boolean[]);
                }
            });
        }, timeStep);
    });
}

function sendEncryptedMsgToAgent(agentId: number, message: string, reason: string = 'assignment'): Promise<void> {
    return databaseServices.agents.get_byId(agentId).then((agent) => {
        if (!agent) {
            logData.addLog('helyos_core', null, 'error', `Msg ${reason} Agent ${agentId} not found in database`);
            return;
        }

        let exchange = rabbitMQServices.AGENTS_DL_EXCHANGE;

        if (agent.protocol === 'MQTT') {
            exchange = rabbitMQServices.AGENTS_MQTT_EXCHANGE;
        }

        let routingKey: string;
        switch (reason) {
            case 'assignment':
                routingKey = `agent.${agent.uuid}.assignment`;
                break;
            case 'order':
                routingKey = `agent.${agent.uuid}.order`;
                break;
            case 'instantActions':
            case 'reserve':
            case 'release':
            case 'cancel':
                routingKey = `agent.${agent.uuid}.instantActions`;
                break;
            default:
                return;
        }

        return rabbitMQServices.sendEncryptedMsg(null, message, agent.public_key!, routingKey, exchange);
    });
}



export default {
    watchWhoIsOnline,
    watchMessageRates,
    sendEncryptedMsgToAgent,
    sendGetReadyForWorkProcessRequest,
    waitAgentStatusForWorkProcess,
    sendReleaseFromWorkProcessRequest,
    sendCustomInstantActionToAgent,
    sendAssignmentToExecuteInAgent,
    cancelAssignmentInAgent
  };