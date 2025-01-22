/* This Source Code is subject to the terms of a modified Apache License Version 2.0.
** If a copy of the license was not distributed with this file, You can obtain one at http://github.com/helyosframework/helyos_core/. 
** Copyright 2022,  Fraunhofer-Institut für Verkehrs- und Infrastruktursysteme IVI.
*/

import * as DatabaseService from '../services/database/database_services';
import { generateAssignmentDependencies } from './assignment_context';
import  AgentCommunication  from './communication/agent_communication';
import { 
    ASSIGNMENT_STATUS,
    MISSION_STATUS,
    MISSION_QUEUE_STATUS,
    SERVICE_STATUS,
    UNCOMPLETE_MISSION_STATUS,
    UNCOMPLETED_SERVICE_STATUS 
} from './data_models';
import { logData } from './systemlog';

interface Assignment {
    id: number;
    status: string;
    next_assignments: number[];
    depend_on_assignments: number[];
    context?: Record<string, any>;
    agent_id?: number;
    work_process_id: number;
}

interface WorkProcess {
    id: number;
    agent_ids?: number[];
    mission_queue_id?: number;
    status: string;
    run_order?: number;
}

interface PartialAssignment {
    id: number;
    status?: string;
}

// ----------------------------------------------------------------------------
// Methods to handle the assignment dispatch and execution 
// ----------------------------------------------------------------------------

async function activateNextAssignmentInPipeline(partialAssignment: PartialAssignment): Promise<void> {
    const databaseServices = await DatabaseService.getInstance();
    const finishedAssignment = await databaseServices.assignments.get_byId(partialAssignment.id);
    const nextAssignments = await databaseServices.assignments.list_in('id', finishedAssignment.next_assignments);
    
    const updatingPromises = nextAssignments
        .filter(a => a.status !== ASSIGNMENT_STATUS.CANCELED)
        .map(nextAssignment => {
            const status = nextAssignment.depend_on_assignments.length === 0
                ? ASSIGNMENT_STATUS.TO_DISPATCH
                : ASSIGNMENT_STATUS.WAIT_DEPENDENCIES;

            return databaseServices.assignments.update_byId(nextAssignment.id, { status });
        });

    await Promise.all(updatingPromises);
}


async function updateAssignmentContext(assignmentId: number): Promise<void> {
    const databaseServices = await DatabaseService.getInstance();
    const assignment = await databaseServices.assignments.get_byId(assignmentId);
    const dependencies = await generateAssignmentDependencies(assignment);

    const context = { dependencies };
    if (!assignment.context) {
        assignment.context = {};
    }
    
    await databaseServices.assignments.update_byId(
        assignmentId,
        { context: { ...assignment.context, ...context } }
    );
}


async function cancelWorkProcessAssignments(id: number): Promise<void> {
    const databaseServices = await DatabaseService.getInstance();
    await databaseServices.assignments.updateByConditions(
        {
            work_process_id: id,
            status__in: [
                ASSIGNMENT_STATUS.TO_DISPATCH,
                ASSIGNMENT_STATUS.NOT_READY_TO_DISPATCH,
                ASSIGNMENT_STATUS.WAIT_DEPENDENCIES
            ]
        },
        { status: ASSIGNMENT_STATUS.CANCELED }
    );

    await databaseServices.assignments.updateByConditions(
        {
            work_process_id: id,
            status__in: [
                ASSIGNMENT_STATUS.EXECUTING,
                ASSIGNMENT_STATUS.ACTIVE
            ]
        },
        { status: ASSIGNMENT_STATUS.CANCELING }
    );
}


async function cancelRequestsToMicroservicesByWPId(id: number): Promise<void> {
    const databaseServices = await DatabaseService.getInstance();
    const n = await databaseServices.service_requests.updateByConditions(
        {
            work_process_id: id,
            status__in: [
                SERVICE_STATUS.NOT_READY,
                SERVICE_STATUS.READY_FOR_SERVICE,
                SERVICE_STATUS.DISPATCHING_SERVICE,
                SERVICE_STATUS.WAIT_DEPENDENCIES,
                SERVICE_STATUS.PENDING
            ]
        },
        { status: SERVICE_STATUS.CANCELED }
    );

    await logData.addLog('helyos_core', { wproc_id: id }, 'warn' , `${n} services canceled`);
}


async function dispatchAssignmentToAgent(partialAssignment: PartialAssignment): Promise<void> {
    const databaseServices = await DatabaseService.getInstance();
    try {
        const assignment = await databaseServices.assignments.get_byId(partialAssignment.id);
        await AgentCommunication.sendAssignmentToExecuteInAgent(assignment);
    } catch (err) {
        await databaseServices.assignments.update_byId(
            partialAssignment.id,
            { status: ASSIGNMENT_STATUS.FAILED }
        );
    }
}

async function cancelAssignmentByAgent(partialAssignment: PartialAssignment): Promise<void> {
    const databaseServices = await DatabaseService.getInstance();
    const assignment = await databaseServices.assignments.get_byId(partialAssignment.id);
    await AgentCommunication.cancelAssignmentInAgent(assignment);
}

/**
 * Release agents reserved by the work process and trigger the next work process in the run list
 * @param workProcessId - The work process id
 * @param reason - The reason for work process end
 */
async function onWorkProcessEnd(workProcessId: number, reason: string): Promise<void> {
    const databaseServices = await DatabaseService.getInstance();
    if (reason !== 'assignments_completed') {
        logData.addLog('helyos_core', { wproc_id: workProcessId }, 'warn' , 'Work process ending: ' + reason);
    }

    // Release agents that received the assignments
    const wpAssignments = await databaseServices.assignments.get(
        'work_process_id',
        workProcessId,
        ['id', 'agent_id', 'work_process_id']
    );
    
    const assmAgentIds = wpAssignments.map(assm => parseInt(assm.agent_id));
    
    // Release agents that were reserved by the work process
    const wproc = await databaseServices.work_processes.get_byId(
        workProcessId,
        ['agent_ids', 'mission_queue_id', 'status']
    );
    
    const wprocAgentIds = wproc.agent_ids || [];

    // Combine the two lists and remove duplicates
    const agentsList = [...new Set([...assmAgentIds, ...wprocAgentIds])];

    // Release all agents related to the work process
    await Promise.all(
        agentsList.map(agentId => 
            AgentCommunication.sendReleaseFromWorkProcessRequest(agentId, workProcessId)
        )
    );

    // For Mission queues, trigger the next work process in the run list
    if (wproc.mission_queue_id && wproc.status === MISSION_STATUS.SUCCEEDED) {
        const nextWorkProcesses = await databaseServices.work_processes.select(
            {
                mission_queue_id: wproc.mission_queue_id,
                status: MISSION_STATUS.DRAFT
            },
            [],
            'run_order'
        );

        if (nextWorkProcesses.length) {
            await databaseServices.work_processes.update_byId(
                nextWorkProcesses[0].id,
                { status: MISSION_STATUS.DISPATCHED }
            );
        } else {
            await databaseServices.mission_queue.update_byId(
                wproc.mission_queue_id,
                { status: MISSION_QUEUE_STATUS.STOPPED }
            );
        }
    }
}

async function assignmentUpdatesMissionStatus(id: number, wprocId: number): Promise<void> {
    const databaseServices = await DatabaseService.getInstance();
    const remainingServiceRequests = await databaseServices.service_requests.select(
        {
            work_process_id: wprocId,
            processed: false,
            status__in: UNCOMPLETED_SERVICE_STATUS
        },
        ['id']
    );

    if (remainingServiceRequests.length === 0) {
        const uncompleteAssgms = await databaseServices.searchAllRelatedUncompletedAssignments(id);
        
        if (uncompleteAssgms.length === 0) {
            const wproc = await databaseServices.work_processes.get_byId(wprocId, ['status']);
            
            if (UNCOMPLETE_MISSION_STATUS.includes(wproc.status)) {
                await databaseServices.work_processes.updateByConditions(
                    {
                        id: wprocId,
                        status__in: UNCOMPLETE_MISSION_STATUS
                    },
                    { status: MISSION_STATUS.ASSIGNMENTS_COMPLETED }
                );
            }
        }
    }
}

export {
    activateNextAssignmentInPipeline,
    updateAssignmentContext,
    cancelWorkProcessAssignments,
    cancelRequestsToMicroservicesByWPId,
    dispatchAssignmentToAgent,
    cancelAssignmentByAgent,
    onWorkProcessEnd,
    assignmentUpdatesMissionStatus,
};