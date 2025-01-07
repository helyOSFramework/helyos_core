// A process is started by the insertion of a work process (see "mission_queue_insertion" notification).
// This triggers the building of a pipeline of services; the pipeline is just an ordered list of service requests 
// (see service_requests table in the Postgres schema).
// Each service request is dispatched as soon as its status changes to "ready_for_service" (see "ready_for_service" notification).

import databaseServices from '../../services/database/database_services';
import { MISSION_QUEUE_STATUS, MISSION_STATUS } from '../../modules/data_models';
import { logData } from '../../modules/systemlog';

// Payload type definition
interface Payload {
    id: number;
    status?: string;
}

/**
 * Handles database change events for mission queue.
 * @param channel The channel name from the database notification.
 * @param payload The payload containing event data.
 */
export async function processRunListEvents(channel: string, payload: Payload): Promise<void> {
    const queueId = payload.id;
    const status = payload.status;

    switch (channel) {
        case 'mission_queue_insertion': {
            if (status === MISSION_QUEUE_STATUS.RUN) {
                try {
                    const missionList = await databaseServices.work_processes.select(
                        { mission_queue_id: queueId, status: 'draft' },
                        [],
                        'run_order ASC'
                    );

                    if (missionList.length) {
                        const nextMission = missionList[0];
                        await databaseServices.mission_queue.update_byId(queueId, { status: MISSION_QUEUE_STATUS.RUNNING });
                        await databaseServices.work_processes.update_byId(nextMission.id, { status: MISSION_STATUS.DISPATCHED });
                    }
                } catch (err: any) {
                    logData.addLog('helyos_core', payload, 'error', `mission_queue_insertion ${err?.message}`);
                }
            }
            break;
        }

        case 'mission_queue_update': {
            if (status === MISSION_QUEUE_STATUS.RUN) {
                try {
                    const missionList = await databaseServices.work_processes.select(
                        { mission_queue_id: queueId, status: 'draft' },
                        [],
                        'run_order ASC'
                    );

                    if (missionList.length) {
                        const nextMission = missionList[0];
                        await databaseServices.mission_queue.update_byId(queueId, { status: MISSION_QUEUE_STATUS.RUNNING });
                        await databaseServices.work_processes.update_byId(nextMission.id, { status: MISSION_STATUS.DISPATCHED });
                    }
                } catch (err: any) {
                    logData.addLog('helyos_core', payload, 'error', `mission_queue_update ${err?.message}`);
                }
            }

            if (status === MISSION_QUEUE_STATUS.CANCEL) {
                try {
                    const missionList = await databaseServices.work_processes.select(
                        { mission_queue_id: queueId, status: MISSION_STATUS.EXECUTING },
                        [],
                        'run_order ASC'
                    );

                    if (missionList.length) {
                        await databaseServices.mission_queue.update_byId(queueId, { status: MISSION_QUEUE_STATUS.STOPPED });
                        for (const mission of missionList) {
                            await databaseServices.work_processes.update_byId(mission.id, { status: MISSION_STATUS.CANCELING });
                        }
                    }
                } catch (err: any) {
                    logData.addLog('helyos_core', payload, 'error', `mission_queue_update ${err?.message}`);
                }
            }
            break;
        }

        default:
            // Ignore unknown channels
            break;
    }
}
