/* This Source Code is subject to the terms of a modified Apache License Version 2.0.
** If a copy of the license was not distributed with this file, You can obtain one at http://github.com/helyosframework/helyos_core/. 
** Copyright 2022,  Fraunhofer-Institut für Verkehrs- und Infrastruktursysteme IVI.
*/
const databaseServices = require('../services/database/database_services.js');
const { generateAssignmentDependencies } = require('./assignment_context.js');
const agentComm = require('./communication/agent_communication.js');
const { ASSIGNMENT_STATUS, MISSION_STATUS, MISSION_QUEUE_STATUS, SERVICE_STATUS,
	    UNCOMPLETE_MISSION_STATUS, UNCOMPLETED_SERVICE_STATUS } = require('./data_models.js');
const { logData } = require('./systemlog.js');


// ----------------------------------------------------------------------------
// Methods to handle the assignment dispatch and execution 
// ----------------------------------------------------------------------------

function activateNextAssignmentInPipeline(partialAssignment) {

	return databaseServices.assignments.get_byId(partialAssignment.id)
	.then( finishedAssignment => {
		return databaseServices.assignments.list_in('id', finishedAssignment.next_assignments)
		.then(nextAssignments => {
			const updatingPromises = nextAssignments.filter(a => a.status!=ASSIGNMENT_STATUS.CANCELED).map(nexAssignment => {

					if (nexAssignment.depend_on_assignments.length === 0) {
						nexAssignment.status = ASSIGNMENT_STATUS.TO_DISPATCH;
					} else {
						nexAssignment.status = ASSIGNMENT_STATUS.WAIT_DEPENDENCIES;
					}
		
					return databaseServices.assignments.update_byId(nexAssignment.id, nexAssignment);
			});

			return Promise.all(updatingPromises);
		});
	})

}


async function updateAssignmentContext(assigmentId) {
	const assignment = await databaseServices.assignments.get_byId(assigmentId);
	// Assignment dependencies
	const dependencies = await generateAssignmentDependencies(assignment);
	
	const context = {'dependencies': dependencies};
	if(!assignment.context) { assignment.context = {}; }
	return	databaseServices.assignments.update_byId(assigmentId, {context: {...assignment.context, ...context}});
};


function cancelWorkProcessAssignments(id){
	return databaseServices.assignments.updateByConditions(
		{ work_process_id: id, status__in: [ASSIGNMENT_STATUS.TO_DISPATCH,
											ASSIGNMENT_STATUS.NOT_READY_TO_DISPATCH,
											ASSIGNMENT_STATUS.WAIT_DEPENDENCIES] },
		{ status: ASSIGNMENT_STATUS.CANCELED }
	).then(() => databaseServices.assignments.updateByConditions(
		{ work_process_id: id, status__in: [ASSIGNMENT_STATUS.EXECUTING,
											ASSIGNMENT_STATUS.ACTIVE] },	
		{ status: ASSIGNMENT_STATUS.CANCELING } // The agent will be notified to cancel the assignment
	));
}


function cancelRequestsToMicroservicesByWPId(id){
	return databaseServices.service_requests.updateByConditions(
		{ work_process_id: id, status__in: [SERVICE_STATUS.NOT_READY,
											SERVICE_STATUS.READY_FOR_SERVICE,
											SERVICE_STATUS.DISPATCHING_SERVICE,
											SERVICE_STATUS.WAIT_DEPENDENCIES,
											SERVICE_STATUS.PENDING]},
		{status: SERVICE_STATUS.CANCELED}
	).then((n) => logData.addLog('helyos_core', {wproc_id:id},'warning', `${n} services canceled`) );
}

function dispatchAssignmentToAgent(partialAssignment) {
	return databaseServices.assignments.get_byId(partialAssignment.id)
	.then(assignment => agentComm.sendAssignmentToExecuteInAgent(assignment))
	.catch(err => databaseServices.assignments.update_byId(partialAssignment.id, {status: ASSIGNMENT_STATUS.FAILED}));
}


function cancelAssignmentByAgent(partialAssignment){
	return databaseServices.assignments.get_byId(partialAssignment.id)
	.then(assignment => { agentComm.cancelAssignmentInAgent(assignment)	
	});
}

/**
 * Release agents reserved by the work process and trigger the next work process in the run list
 * @param {number} workProcessId - The work process id
 */
async function onWorkProcessEnd(workProcessId, reason){

	if (reason !== 'assignments_completed') {
		logData.addLog('helyos_core', {wproc_id:workProcessId},'warning', 'Work process ending: ' + reason);
	}

	// Release agents that received the assignments
	const wpAssignments= await databaseServices.assignments.get('work_process_id', workProcessId, ['id','agent_id', 'work_process_id']);
	const assmAgentIds = wpAssignments.map(assm => parseInt(assm.agent_id));
 	// Release agents that were reserved by the work process
	const wproc = await databaseServices.work_processes.get_byId(workProcessId, ['agent_ids', 'mission_queue_id', 'status']);
	const wprocAgentIds = wproc.agent_ids? wproc.agent_ids : [];

	// Combine the two lists and remove duplicates.
	const agentsList = [...new Set([...assmAgentIds, ...wprocAgentIds])];

	// Release all agents related to the work process
	agentsList.forEach(async agentId => await agentComm.sendReleaseFromWorkProcessRequest(agentId, workProcessId));

	// For Mission queues, trigger the next work process in the run list
	if(wproc.mission_queue_id) {
		if (wproc.status === MISSION_STATUS.SUCCEEDED) {
			databaseServices.work_processes.select({mission_queue_id:wproc.mission_queue_id, status: MISSION_STATUS.DRAFT}, [], 'run_order')
			.then(nextWorkProcesses => {
					if (nextWorkProcesses.length) {
						databaseServices.work_processes.update_byId(nextWorkProcesses[0].id, {status:MISSION_STATUS.DISPATCHED}); 
					} else {
						databaseServices.mission_queue.update_byId(wproc.mission_queue_id, {status: MISSION_QUEUE_STATUS.STOPPED});
					}
			});
		}
	}

}

async function assignmentUpdatesMissionStatus(id, wprocId) {
	const remaingServiceRequests = await databaseServices.service_requests.select({ work_process_id: wprocId,
																					processed: false,
																					status__in: UNCOMPLETED_SERVICE_STATUS},
																					['id']);
	if (remaingServiceRequests.length === 0) {
		const uncompleteAssgms = await databaseServices.searchAllRelatedUncompletedAssignments(id);
		if (uncompleteAssgms.length == 0) {
			await databaseServices.work_processes.get_byId(wprocId, ['status'])
			.then( wproc => {
				if (UNCOMPLETE_MISSION_STATUS.includes(wproc.status)) {
					return databaseServices.work_processes.update_byId(wprocId, { status: MISSION_STATUS.ASSIGNMENTS_COMPLETED});
				}
			});
		}
	}
}


module.exports.cancelWorkProcessAssignments = cancelWorkProcessAssignments;
module.exports.assignmentUpdatesMissionStatus = assignmentUpdatesMissionStatus;
module.exports.dispatchAssignmentToAgent = dispatchAssignmentToAgent;
module.exports.cancelAssignmentByAgent = cancelAssignmentByAgent;
module.exports.onWorkProcessEnd = onWorkProcessEnd;
module.exports.activateNextAssignmentInPipeline = activateNextAssignmentInPipeline;
module.exports.updateAssignmentContext = updateAssignmentContext;
module.exports.cancelRequestsToMicroservicesByWPId = cancelRequestsToMicroservicesByWPId;
