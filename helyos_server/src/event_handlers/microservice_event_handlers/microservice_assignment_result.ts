// Services imports
import { AGENT_STATUS, ASSIGNMENT_STATUS, MISSION_STATUS } from '../../modules/data_models';
import { logData } from '../../modules/systemlog';
import * as DatabaseService from '../../services/database/database_services';

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
export async function createAssignment(workProcess: WorkProcess, servResponse: ServiceResponse, serviceRequest: ServiceRequest): Promise<any> {
    const databaseServices = await DatabaseService.getInstance();
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

    let assignmentInputs: AssignmentInput[] = [];
    let instantActionsInput: InstantActionInput[] = [];
    let assignmentPlan: number[] = [];
    const dispatch_order = servResponse.dispatch_order;

    if (servResponse.results) {
        const results = servResponse.results;

        for (const result of results) {
            let agent_id = parseInt(result.agent_id as any);

            if (result.agent_uuid) {
                agent_id = await databaseServices.agents
                    .getIds([result.agent_uuid])
                    .then((ids) => ids[0]);
            }

            const hasAgent = agent_id
                ? await databaseServices.agents.get_byId(agent_id).then((agent) => agent)
                : false;

            if (!hasAgent) {
                logData.addLog('helyos_core', null, 'error', `Assignment planner did not return a valid agent_id or agent_uuid in the result.`);
                throw new Error(`Assignment planner did not return a valid agent_id or agent_uuid in the result.`);
            }

            if (!agentIds.includes(agent_id!) && !result.instant_action) {
                logData.addLog('helyos_core', null, 'error', `Assignment planner agent_id ${agent_id} was not included in the work_process ${workProcess.id} agent_ids.`);
            }

            if (result.instant_action) {
                instantActionsInput.push({
                    yard_id: yardId,
                    agent_id: agent_id!,
                    sender: `micoservice request: ${serviceRequest.id}`,
                    command: result.instant_action.command,
                    status: 'dispatched',
                });
            }

            if (result.assignment || result.result) {
                assignmentInputs.push({
                    yard_id: yardId,
                    work_process_id: workProcess.id,
                    agent_id: agent_id!,
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
        assignmentInputs = agentIds.map((agentId) => ({
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
    const insertPromises = assignmentInputs.map((input) =>
        databaseServices.assignments.insert(input)
    );

    // Handle assignment orchestration
    let updatePromises: Promise<any>[] = [];
    let assignment_orchestration = '';
    if (dispatch_order && dispatch_order.length) assignment_orchestration = 'dispatch_order_array';
    else if (assignmentPlan && assignmentPlan.length) assignment_orchestration = 'assignment_order_array';
    else assignment_orchestration = 'dispatch_all_at_once';

    return Promise.all(insertPromises)
        .then((insertedIds) => {
            if (assignment_orchestration === 'dispatch_all_at_once') {
                updatePromises = insertedIds.map(id => databaseServices.assignments.update_byId(id, { status: ASSIGNMENT_STATUS.TO_DISPATCH }));
            }

            if (assignment_orchestration === 'dispatch_order_array') {
                updatePromises = insertedIds.map(id => databaseServices.assignments.update_byId(id, { status: ASSIGNMENT_STATUS.TO_DISPATCH }));
                if (dispatch_order!.length === 1) dispatch_order!.push([]); // special case: there is no dependent assignments.
                for (let order = dispatch_order!.length - 1; order > 0; order--) {
                    const assgmtArrayIdxs = dispatch_order![order];
                    const previousArrayIdxs = dispatch_order![order - 1];
                    const assgmtDBIdxs = assgmtArrayIdxs.map(i => insertedIds[i]);
                    const previousDBIdxs = previousArrayIdxs.map(i => insertedIds[i]);
                    const statusPrecedent = (order - 1) === 0 ? ASSIGNMENT_STATUS.TO_DISPATCH : ASSIGNMENT_STATUS.NOT_READY_TO_DISPATCH;
                    const updatePrecedentAssignments = previousDBIdxs.map(id => databaseServices.assignments.update_byId(id, {
                        'next_assignments': assgmtDBIdxs,
                        'status': statusPrecedent
                    }));
                    const updateDependentAssignments = assgmtDBIdxs.map(id => databaseServices.assignments.update_byId(id, { 'depend_on_assignments': previousDBIdxs }));
                    updatePromises = updatePromises.concat([...updateDependentAssignments, ...updatePrecedentAssignments]);
                }
            }

            if (assignment_orchestration === 'assignment_order_array') {
                const dispatchGroup: { [key: number]: number[] } = {};
                // Group assignments
                assignmentPlan.forEach((order, index) => {
                    if (!dispatchGroup[order]) dispatchGroup[order] = [insertedIds[index]];
                    else dispatchGroup[order].push(insertedIds[index]);
                });

                assignmentPlan.forEach(order => {
                    const ids = dispatchGroup[order];
                    const nextIds = dispatchGroup[order + 1];
                    const prevIds = dispatchGroup[order - 1];

                    const nextAssignments = nextIds ? nextIds : [];
                    const dependOnAssignments = prevIds ? prevIds : [];

                    const updateDependencies = ids.map(id => databaseServices.assignments.update_byId(id, {
                        'next_assignments': nextAssignments,
                        'depend_on_assignments': dependOnAssignments
                    }));
                    updatePromises = updatePromises.concat([...updateDependencies]);
                });

                let dispatchTriggerPromises: Promise<void>[] = [];
                if (dispatchGroup[1]) {
                    dispatchTriggerPromises = dispatchGroup[1].map(id =>
                        databaseServices.assignments.update_byId(id, { 'status': ASSIGNMENT_STATUS.TO_DISPATCH })
                    );
                }
                updatePromises = [Promise.all(updatePromises).then(() => Promise.all(dispatchTriggerPromises))];
            }

            return Promise.all(updatePromises).then(() => {
                const statusUpdatePromises = assignmentInputs.map((input) =>
                    databaseServices.service_requests.update_byId(serviceRequest.id, { assignment_dispatched: true })
                        .then(() => databaseServices.work_processes.updateByConditions(
                            { 'id': workProcess.id, 'status__in': [MISSION_STATUS.DISPATCHED, MISSION_STATUS.CALCULATING, MISSION_STATUS.PREPARING] },
                            { status: MISSION_STATUS.EXECUTING }))
                );
                return Promise.all(statusUpdatePromises);
            });
        })
        .catch(err => logData.addLog('helyos_core', null, 'error', `createAssignment ${err.message}`));
}