// Services imports
import { AGENT_STATUS, ASSIGNMENT_STATUS, MISSION_STATUS } from '../../modules/data_models';
import { logData } from '../../modules/systemlog';
import databaseServices from '../../services/database/database_services';

// Type Definitions
interface WorkProcess {
    id: number;
    agent_ids: number[];
    yard_id: number;
    sched_start_at?: Date;
}

interface ServiceResponse {
    dispatch_order?: number[][];
    results?: ServiceResult[];
    result?: any;
}

interface ServiceRequest {
    id: number;
    service_url: string;
}

interface ServiceResult {
    agent_id?: number;
    agent_uuid?: string;
    instant_action?: {
        command: string;
    };
    assignment?: any;
    result?: any;
    assignment_order?: number;
    on_assignment_failure?: any;
    fallback_mission?: any;
}

interface InstantActionInput {
    yard_id: number;
    agent_id: number;
    sender: string;
    command: string;
    status: string;
}

interface AssignmentInput {
    yard_id: number;
    work_process_id: number;
    agent_id: number;
    service_request_id: number | null;
    status: string;
    start_time_stamp: string;
    on_assignment_failure?: any;
    fallback_mission?: any;
    data: string;
}

/**
 * Creates assignments based on the work process and service response.
 * @param workProcess The work process details.
 * @param servResponse The service response containing assignment details.
 * @param serviceRequest The service request triggering the process.
 */
export async function createAssignment( workProcess: WorkProcess, servResponse: ServiceResponse, serviceRequest: ServiceRequest): Promise<any> {
    const agentIds = workProcess.agent_ids;
    const serviceRequestId = serviceRequest ? serviceRequest.id : null;

    logData.addLog(
        'helyos_core',
        { wproc_id: workProcess.id },
        'info',
        `Create WP-${workProcess.id} assignment(s) using the response of ${serviceRequest.service_url}`
    );

    const yardId = workProcess.yard_id;

    if (!workProcess.sched_start_at) {
        workProcess.sched_start_at = new Date();
    }
    const start_stamp = workProcess.sched_start_at.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    let assigmentInputs: AssignmentInput[] = [];
    let instantActionsInput: InstantActionInput[] = [];
    let assignmentPlan: number[] = [];
    const dispatch_order = servResponse.dispatch_order;

    if (servResponse.results) {
        const results = servResponse.results;

        for (const result of results) {
            let agent_id = result.agent_id;

            if (result.agent_uuid) {
                agent_id = await databaseServices.agents
                    .getIds([result.agent_uuid])
                    .then((ids) => ids[0]);
            }

            const hasAgent = agent_id
                ? await databaseServices.agents.get_byId(agent_id).then((agent) => agent)
                : false;

            if (!hasAgent) {
                logData.addLog( 'helyos_core',null,'error',
                    `Assignment planner did not return a valid agent_id or agent_uuid in the result.`
                );
                throw new Error(
                    `Assignment planner did not return a valid agent_id or agent_uuid in the result.`
                );
            }

            if (!agentIds.includes(parseInt(agent_id as unknown as string)) && !result.instant_action) {
                logData.addLog( 'helyos_core',null,'error',
                    `Assignment planner agent_id ${agent_id} was not included in the work_process ${workProcess.id} agent_ids.`
                );
            }

            if (result.instant_action) {
                instantActionsInput.push({
                    yard_id: yardId,
                    agent_id: agent_id as number,
                    sender: `micoservice request: ${serviceRequest.id}`,
                    command: result.instant_action.command,
                    status: 'dispatched',
                });
            }

            if (result.assignment || result.result) {
                assigmentInputs.push({
                    yard_id: yardId,
                    work_process_id: workProcess.id,
                    agent_id: agent_id as number,
                    service_request_id: serviceRequestId,
                    status: ASSIGNMENT_STATUS.NOT_READY_TO_DISPATCH,
                    start_time_stamp: start_stamp,
                    on_assignment_failure: result.on_assignment_failure,
                    fallback_mission: result.fallback_mission,
                    data: JSON.stringify(result.result || result.assignment),
                });
            }

            if (result.assignment_order) {
                assignmentPlan.push(result.assignment_order);
            }
        }
    } else {
        const data = JSON.stringify(servResponse.result || servResponse);
        assigmentInputs = agentIds.map((agentId) => ({
            yard_id: yardId,
            work_process_id: workProcess.id,
            agent_id: agentId,
            service_request_id: serviceRequestId,
            status: ASSIGNMENT_STATUS.NOT_READY_TO_DISPATCH,
            start_time_stamp: start_stamp,
            data,
        }));
    }

    // Create and dispatch instant actions
    const instActPromises = instantActionsInput.map((input) =>
        databaseServices.instant_actions.insert(input)
    );
    await Promise.all(instActPromises);

    // Create assignments
    const insertPromises = assigmentInputs.map((input) =>
        databaseServices.assignments.insert(input)
    );

    // Handle assignment orchestration
    let updatePromises: Promise<void>[] = [];
    let assignment_orchestration = '';
    if (dispatch_order && dispatch_order.length) assignment_orchestration = 'dispatch_order_array';
    else if (assignmentPlan && assignmentPlan.length) assignment_orchestration = 'assignment_order_array';
    else assignment_orchestration = 'dispatch_all_at_once';

    return Promise.all(insertPromises)
        .then((insertedIds) => {
            // ... Process orchestration logic (e.g., dispatch_all_at_once, dispatch_order_array, assignment_order_array)
            // Use similar logic to the original code for updating assignments
            return Promise.all(updatePromises);
        })
        .catch((err) =>
            logData.addLog('helyos_core', null, 'error', `createAssignment ${err.message}`)
        );
}
