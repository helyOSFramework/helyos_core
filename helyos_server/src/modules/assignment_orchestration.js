/* This Source Code is subject to the terms of a modified Apache License Version 2.0.
** If a copy of the license was not distributed with this file, You can obtain one at http://github.com/helyosframework/helyos_core/. 
** Copyright 2022,  Fraunhofer-Institut für Verkehrs- und Infrastruktursysteme IVI.
*/
const databaseServices = require('../services/database/database_services.js');
const { generateAssignmentDependencies } = require('./assignment_context.js');
const agentComm = require('./communication/agent_communication.js');
const { ASSIGNMENT_STATUS, MISSION_STATUS } = require('./data_models.js');


// ----------------------------------------------------------------------------
// Methods to handle the assignment dispatch and execution 
// ----------------------------------------------------------------------------

function activateNextAssignmentInPipeline(partialAssignment) {

	databaseServices.assignments.get_byId(partialAssignment.id)
	.then( finishedAssignment => {
		databaseServices.assignments.list_in('id', finishedAssignment.next_assignments)
		.then(nextAssignments => {
			const updatingPromises = nextAssignments.filter(a => a.status!=ASSIGNMENT_STATUS.CANCELED).map(nexAssignment => {

					if (nexAssignment.depend_on_assignments.length === 0) {
						nexAssignment.status = 'to_dispatch';
					} else {
						nexAssignment.status = 'wait_dependencies';
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
	const dependencies = await generateAssignmentDependencies(assignment.nextAssignments);
	
	const context = {'dependencies': dependencies};
	if(!assignment.context) { assignment.context = {}; }
	return	databaseServices.assignments.update_byId(assigmentId, {context: {...assignment.context, ...context}});
};


function cancelWorkProcessAssignmentsAndRequests(id){
	databaseServices.cancelAllAssignments_byWPId(id);
	databaseServices.cancelAllRequestToMicroservices_byWPId(id);
}


function dispatchAssignmentToAgent(partialAssignment) {
	return databaseServices.assignments.get_byId(partialAssignment.id)
	.then(assignment => agentComm.sendAssignmentToExecuteInAgent(assignment));
}


function cancelAssignmentByAgent(partialAssignment){
	return databaseServices.assignments.get_byId(partialAssignment.id)
	.then(assignment => { agentComm.cancelAssignmentInAgent(assignment)	
	});
}


function onWorkProcessEnd(workProcessId){
	// Release agents connected to the work process assignments
	databaseServices.assignments.get('work_process_id', workProcessId, ['id','agent_id', 'work_process_id'])
	.then((assmList)=>assmList.forEach(assm =>agentComm.sendReleaseFromWorkProcessRequest(assm.agent_id, assm.work_process_id)));

	databaseServices.work_processes.get_byId(workProcessId, ['agent_ids', 'mission_queue_id', 'status'])
		.then((wproc) => {
			// Release agents connected directly to the work process 
			const agentsList = wproc.agent_ids;
			if (agentsList) {agentsList.forEach(agentId => agentComm.sendReleaseFromWorkProcessRequest(agentId, workProcessId))}; 

			// Trigger the next work process in the run list
			if(wproc.mission_queue_id) {
				if (wproc.status === MISSION_STATUS.SUCCEEDED) {
					databaseServices.work_processes.select({mission_queue_id:wproc.mission_queue_id, status: MISSION_STATUS.DRAFT}, [], 'run_order')
					.then(nextWorkProcesses => {
							if (nextWorkProcesses.length) {
								databaseServices.work_processes.update_byId(nextWorkProcesses[0].id, {status:MISSION_STATUS.DISPATCHED}); 
							} else {
								databaseServices.mission_queue.update_byId(wproc.mission_queue_id, {status:'stopped'})
							}
					});
				}
			}
	});
}

async function assignmentEnd(id, wprocId) {
	const remaingServiceRequests = await databaseServices.service_requests.select({ work_process_id: wprocId, processed: false }, ['id']);
	if (remaingServiceRequests.length === 0) {
		const uncompleteAssgms = await databaseServices.searchAllRelatedUncompletedAssignments(id);
		if (uncompleteAssgms.length == 0) {
			await databaseServices.work_processes.update_byId(wprocId, { status: MISSION_STATUS.ASSIGNMENTS_COMPLETED});
		}
	}
}


module.exports.cancelWorkProcessAssignmentsAndRequests = cancelWorkProcessAssignmentsAndRequests;
module.exports.assignmentEnd = assignmentEnd;
module.exports.dispatchAssignmentToAgent = dispatchAssignmentToAgent;
module.exports.cancelAssignmentByAgent = cancelAssignmentByAgent;
module.exports.onWorkProcessEnd = onWorkProcessEnd;
module.exports.activateNextAssignmentInPipeline = activateNextAssignmentInPipeline;
module.exports.updateAssignmentContext = updateAssignmentContext;

