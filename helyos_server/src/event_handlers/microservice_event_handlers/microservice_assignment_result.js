// Services imports
const { AGENT_STATUS, ASSIGNMENT_STATUS, MISSION_STATUS } = require('../../modules/data_models.js');
const { logData } = require('../../modules/systemlog.js');
const databaseServices = require('../../services/database/database_services.js')

// ----------------------------------------------------------------------------
// Work Process => Work Process Type Definitions => Service Request(s) => Assignment(s)
// ----------------------------------------------------------------------------


async function createAssignment(workProcess, servResponse, serviceRequest){

	const agentIds = workProcess.agent_ids;
	const serviceRequestId = serviceRequest?  serviceRequest.id:null
    logData.addLog('helyos_core', {wproc_id: workProcess.id}, 'info', `Create WP-${ workProcess.id} assignment(s) using the response of ${serviceRequest.service_url}`);

	const yardId = workProcess.yard_id;


	if (!workProcess.sched_start_at) {
		workProcess.sched_start_at = new Date();
	}
	const start_stamp = workProcess.sched_start_at.toISOString().replace(/T/, ' ').replace(/\..+/, '');
	let assigmentInputs = [], instantActionsInput = []; assignmentPlan = [];
	let dispatch_order = servResponse.dispatch_order;  

	if (servResponse.results) {
		let results = servResponse.results;  

		for (let index = 0; index < results.length; index++) {
			const result = results[index];
			let agent_id = result.agent_id;
			if (result.agent_uuid) {
				agent_id = await databaseServices.agents.getIds([result.agent_uuid]).then(ids=>ids[0]);
			}
			
			let hasAgent;
			if (!agent_id) {
				hasAgent = false;
			} else {
				hasAgent = await databaseServices.agents.get_byId(agent_id).then(agent=>agent);
			}

			if (!hasAgent) {
				logData.addLog('helyos_core', null, 'error', `Assignment planner did not return a valid agent_id or agent_uuid in the result.`);
				throw new Error(`Assignment planner did not return a valid agent_id or agent_uuid in the result.`);
			}

			if (!agentIds.includes(parseInt(agent_id)) && !result.instant_action){
				logData.addLog('helyos_core', null, 'error', `Assignment planner agent_id ${agent_id} was not included in the work_process ${workProcess.id} agent_ids.`+
				` In future versions, this will block the mission execution.`);
			}


			if(result.instant_action) {
				instantActionsInput.push({
					yard_id: yardId,
					agent_id: agent_id,
					sender: `micoservice request: ${serviceRequest.id}`,
					command:  result.instant_action.command,
					status: 'dispatched'
				});
			}

			if (result.assignment || result.result) {
				assigmentInputs.push({
					yard_id: yardId,
					work_process_id: workProcess.id,
					agent_id: agent_id, 
					service_request_id: serviceRequestId,
					status: ASSIGNMENT_STATUS.NOT_READY_TO_DISPATCH,
					start_time_stamp: start_stamp,
					on_assignment_failure: result.on_assignment_failure  || result.onAssignmentFailure, 
					fallback_mission: result.fallback_mission || result.fallbackMission,
					data: JSON.stringify(result.result || result.assignment)});
			}

			if (result.dispatch_order || result.assignment_order) {
				assignmentPlan.push(result.dispatch_order || result.assignment_order);

			}

		}
			
	} else {  // keep compatibility: in old versions of external services, one assigment is sent to all agent Ids.
		let data; 
		if(servResponse.result) {
			data = JSON.stringify(servResponse.result);
		} else {
			data = JSON.stringify(servResponse);
		}
		assigmentInputs = agentIds.map( agentId => ({
										yard_id: yardId,
										work_process_id: workProcess.id,
										agent_id: agentId,
										service_request_id: serviceRequestId,
										status: ASSIGNMENT_STATUS.NOT_READY_TO_DISPATCH,
										start_time_stamp: start_stamp,
										data: data}
		));
	}

	// create and dispatch instant actions
	const instActPromises = instantActionsInput.map( input => databaseServices.instant_actions.insert(input).then( newId => newId));
	await Promise.all(instActPromises);

	// create assignments
	const insertPromises = assigmentInputs.map( input => databaseServices.assignments.insert(input).then( newId => newId));

	// update assginments; sorting them.
	let updatePromises = [];
	let assignment_orchestration = '';
	if (dispatch_order && dispatch_order.length) assignment_orchestration = 'dispatch_order_array';
	else if (assignmentPlan && assignmentPlan.length) assignment_orchestration = 'assignment_order_array';
	else assignment_orchestration = 'dispatch_all_at_once';

	// validating assigment plans
	


	return Promise.all(insertPromises)
	.then((insertedPromiseIds)=>{

		if (assignment_orchestration ===  'dispatch_all_at_once') {
			updatePromises = insertedPromiseIds.map(id => databaseServices.assignments.update_byId(id,{status: ASSIGNMENT_STATUS.TO_DISPATCH}));
		}

		if (assignment_orchestration ===  'dispatch_order_array') {
			updatePromises = insertedPromiseIds.map(id => databaseServices.assignments.update_byId(id,{status: ASSIGNMENT_STATUS.TO_DISPATCH}));
			if (dispatch_order.length === 1 ) dispatch_order.push([]); // special case: there is no dependent assignments.
			for (let order = dispatch_order.length-1; order > 0; order--) {
				const assgmtArrayIdxs = dispatch_order[order];
				const previousArrayIdxs = dispatch_order[order-1];
				const assgmtDBIdxs = assgmtArrayIdxs.map(i => parseInt(insertedPromiseIds[i]) );
				const previousDBIdxs = previousArrayIdxs.map(i => parseInt(insertedPromiseIds[i]));
				const statusPrecedent = (order-1) === 0 ?  ASSIGNMENT_STATUS.TO_DISPATCH : ASSIGNMENT_STATUS.NOT_READY_TO_DISPATCH;
				const updatePrecedentAssignments = previousDBIdxs.map(id => databaseServices.assignments.update_byId(id,{'next_assignments': assgmtDBIdxs,
																														 'status': statusPrecedent }
																													));
				const updateDependentAssignments = assgmtDBIdxs.map(id => databaseServices.assignments.update_byId(id,{'depend_on_assignments':previousDBIdxs}));
				updatePromises = updatePromises.concat([...updateDependentAssignments, ...updatePrecedentAssignments]);
			}
		}
		
		if (assignment_orchestration ===  'assignment_order_array') {
			const dispatchGroup = {};
			// Group assignments
			assignmentPlan.forEach((order, index) => { 
				if (!dispatchGroup[order]) dispatchGroup[order] = [insertedPromiseIds[index]];
				else dispatchGroup[order].push(insertedPromiseIds[index]);
			});

			assignmentPlan.forEach(order => {
				const ids = dispatchGroup[order];
				const nextIds = dispatchGroup[order + 1];
				const prevIds = dispatchGroup[order - 1];
		
				const nextAssignments = nextIds ? nextIds : [];
				const dependOnAssignments = prevIds ? prevIds : [];
		
				const updateDependencies = ids.map( id => databaseServices.assignments.update_byId(id, {
													'next_assignments': nextAssignments,
													'depend_on_assignments': dependOnAssignments
												}));
				updatePromises = updatePromises.concat([...updateDependencies]);
			});

			let dispatchTriggerPromises = [];
			if (dispatchGroup[1]) {
					dispatchTriggerPromises = dispatchGroup[1].map(id =>
						databaseServices.assignments.update_byId(id, { 'status': ASSIGNMENT_STATUS.TO_DISPATCH })
					);		
			}
			updatePromises = [Promise.all(updatePromises).then(()=> Promise.all(dispatchTriggerPromises))];

		}



		return Promise.all(updatePromises)
		.then(()=>{
			const statusUpdatePromises = assigmentInputs.map( input => 
				databaseServices.service_requests.update_byId(serviceRequest.id, {assignment_dispatched: true})
				.then(() =>  databaseServices.agents.update('id', input.agentId, {status:AGENT_STATUS.BUSY})) // COMMENT: This should not be necessary here.
				.then(() =>  databaseServices.work_processes.updateByConditions(
					{'id': workProcess.id, 'status__in': [ MISSION_STATUS.DISPATCHED,
															MISSION_STATUS.CALCULATING,
															MISSION_STATUS.PREPARING]},
					{status: MISSION_STATUS.EXECUTING}))
			);
			return Promise.all(statusUpdatePromises);
		})

	})
	.catch(err => logData.addLog('helyos_core', null, 'error', `createAssignment ${err.message}`));

}




module.exports.createAssignment = createAssignment;
