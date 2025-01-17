// ----------------------------------------------------------------------------
// Postgres notification pipeline setup: Postgres -> Node.js -> (Front-end socket or Message Broker or External Service)
// ----------------------------------------------------------------------------

// A process is started by the insertion of a work process (see "work_processes_insertion" notification).
// This triggers the building of a pipeline of services; the pipeline is just an ordered list of service requests
// (see service_requests table in the Postgres schema).
// Each service request is dispatched as soon as its status changes to "ready_for_service" (see "ready_for_service" notification).

import * as blAssignm from '../../modules/assignment_orchestration';
import * as blMicroservice from '../../modules/microservice_orchestration';
import databaseServices from '../../services/database/database_services';
import { MISSION_STATUS, ASSIGNMENT_STATUS, ON_ASSIGNMENT_FAILURE_ACTIONS } from '../../modules/data_models';
import { logData } from '../../modules/systemlog';

interface Payload {
    id: number;
    status: string;
    yard_uid?: string;
    agent_uuids?: string[];
    tools_uuids?: string[];
}

/**
 * Handles work process database change events.
 * @param channel The channel name from the database notification.
 * @param payload The payload containing event data.
 */
export function processWorkProcessEvents(channel: string, payload: Payload): void {
    let workProcessId: number;
    let workProcessStatus: string;

    switch (channel) {
        case 'work_processes_insertion': {
            workProcessId = payload.id;
            workProcessStatus = payload.status;

            let prepareWPData: Promise<void> = Promise.resolve();

            const {
                yard_uid,
            } = payload;
            if (yard_uid) {
                prepareWPData = databaseServices.yards
                    .select({
                        uid: yard_uid,
                    }, ['id'])
                    .then((result) => {
                        if (result.length) {
                            return databaseServices.work_processes.update_byId(workProcessId, {
                                yard_id: result[0].id,
                            });
                        } else {
                            logData.addLog('helyos_core', {
                                wproc_id: workProcessId,
                            }, 'error', `Yard UID:${yard_uid} not found`);
                            return Promise.reject(new Error(`Yard UID:${yard_uid} not found`));
                        }
                    })
                    .catch((err) => {
                        logData.addLog('helyos_core', {
                            wproc_id: workProcessId,
                        }, 'error', `work_processes_insertion ${err?.message}`);
                    });
            }

            const uuids = payload.agent_uuids || payload.tools_uuids; // Compatibility with tool table.
            if (uuids?.length) {
                prepareWPData = prepareWPData.then(() =>
                    databaseServices.agents.getIds(uuids).then((agentIds) =>
                        databaseServices.work_processes.update_byId(workProcessId, {
                            agent_ids: agentIds,
                        })
                    )
                );
            }

            if (workProcessStatus === MISSION_STATUS.DISPATCHED || workProcessStatus === 'created') {
                databaseServices.work_processes
                    .update_byId(payload.id, {
                        status: MISSION_STATUS.PREPARING,
                    })
                    .then(() =>
                        prepareWPData.then(() =>
                            blMicroservice.prepareServicesPipelineForWorkProcess(payload).catch((err) => {
                                logData.addLog('helyos_core', {
                                    wproc_id: payload.id,
                                }, 'error', `work_processes_insertion ${err?.message}`);
                            })
                        )
                    )
                    .catch((err) => {
                        logData.addLog('helyos_core', {
                            wproc_id: payload.id,
                        }, 'error', `work_processes_insertion ${err?.message}`);
                    });
            } else {
                prepareWPData.catch((err) => {
                    logData.addLog('helyos_core', {
                        wproc_id: payload.id,
                    }, 'error', `work_processes_insertion ${err?.message}`);
                });
            }
            break;
        }

        case 'work_processes_update': {
            workProcessStatus = payload.status;

            if (workProcessStatus === MISSION_STATUS.SUCCEEDED) {
                logData.addLog('helyos_core', {
                    wproc_id: payload.id,
                }, 'success', `Work process ${payload.id} status: ${workProcessStatus}`);
            }

            switch (workProcessStatus) {
                case MISSION_STATUS.DISPATCHED: {
                    databaseServices.work_processes
                        .updateByConditions(
                            {
                                id: payload.id,
                                status: MISSION_STATUS.DISPATCHED,
                            },
                            {
                                status: MISSION_STATUS.DISPATCHED,
                            }
                        )
                        .then(() => blMicroservice.prepareServicesPipelineForWorkProcess(payload))
                        .catch((err) => {
                            logData.addLog('helyos_core', {
                                wproc_id: payload.id,
                            }, 'error', `work_processes_update ${err?.message}`);
                        });
                    break;
                }

                case 'cancelling':
                case MISSION_STATUS.CANCELING: {
                    databaseServices.work_processes
                        .updateByConditions({
                            id: payload.id,
                            status: MISSION_STATUS.CANCELING,
                        }, {
                            status: MISSION_STATUS.CANCELED,
                        })
                        .then(() =>
                            blAssignm
                                .cancelRequestsToMicroservicesByWPId(payload.id)
                                .then(() => blAssignm.cancelWorkProcessAssignments(payload.id))
                                .then(() => blAssignm.onWorkProcessEnd(payload.id, workProcessStatus))
                        )
                        .catch((err) => {
                            logData.addLog('helyos_core', {
                                wproc_id: payload.id,
                            }, 'error', `work_processes_update ${err?.message}`);
                        });
                    break;
                }

                case MISSION_STATUS.ASSIGNMENT_FAILED:
                case MISSION_STATUS.PLANNING_FAILED: {
                    databaseServices.work_processes
                        .updateByConditions(
                            {
                                id: payload.id,
                                status: workProcessStatus,
                            },
                            {
                                status: MISSION_STATUS.FAILED,
                            }
                        )
                        .then(() =>
                            blAssignm
                                .cancelRequestsToMicroservicesByWPId(payload.id)
                                .then(() => blAssignm.cancelWorkProcessAssignments(payload.id))
                                .then(() => blAssignm.onWorkProcessEnd(payload.id, workProcessStatus))
                        )
                        .catch((err) => {
                            logData.addLog('helyos_core', {
                                wproc_id: payload.id,
                            }, 'error', `work_processes_update ${err?.message}`);
                        });
                    break;
                }

                case MISSION_STATUS.ASSIGNMENTS_COMPLETED: {
                    databaseServices.assignments
                        .select({
                            work_process_id: payload.id,
                            status: ASSIGNMENT_STATUS.CANCELED,
                        })
                        .then((result) => {
                            const newStatus = result.length ? MISSION_STATUS.CANCELED : MISSION_STATUS.SUCCEEDED;
                            return databaseServices.work_processes
                                .update_byId(payload.id, {
                                    status: newStatus,
                                })
                                .then(() => blAssignm.onWorkProcessEnd(payload.id, newStatus));
                        })
                        .catch((err) => {
                            logData.addLog('helyos_core', {
                                wproc_id: payload.id,
                            }, 'error', `work_processes_update ${err?.message}`);
                        });
                    break;
                }

                default:
                    break;
            }
            break;
        }

        default:
            break;
    }
}
