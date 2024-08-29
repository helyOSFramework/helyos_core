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
    logData.addLog('helyos_core', {wproc_id: workProcess.id}, 'info', `Create assignment(s) using the response of ${serviceRequest.service_url}`);
	console.log(`WORKPROCESS ${workProcess.id}: Create assignment(s) using the response of ${serviceRequest.service_url}`);

	const yardId = workProcess.yard_id;


	if (!workProcess.sched_start_at) {
		workProcess.sched_start_at = new Date();
	}
	const start_stamp = workProcess.sched_start_at.toISOString().replace(/T/, ' ').replace(/\..+/, '');
	let assigmentInputs = [];
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

			if (!agentIds.includes(parseInt(agent_id))){
				logData.addLog('helyos_core', null, 'error', `Assignment planner agent_id ${agent_id} was not included in the work_process ${workProcess.id} agent_ids.`+
				` In future versions, this will block the mission execution.`);
			}


			console.log()


			assigmentInputs.push({
				yard_id: yardId,
				work_process_id: workProcess.id,
				agent_id: agent_id, 
				service_request_id: serviceRequestId,
				status: 'not_ready_to_dispatch',
				start_time_stamp: start_stamp,
				on_assignment_failure: result.on_assignment_failure  || result.onAssignmentFailure, 
				data: JSON.stringify(result.result || result.assignment)});
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
										status: 'not_ready_to_dispatch',
										start_time_stamp: start_stamp,
										data: data}
		));
	}

	// create assignments
	const insertPromises = assigmentInputs.map( input => databaseServices.assignments.insert(input).then( newId => newId));
	let updatePromises = [];

	return Promise.all(insertPromises)
	.then((insertedPromiseIds)=>{
		// ordering assignment dispatches
			if (dispatch_order && dispatch_order.length) {
				if (dispatch_order.length === 1 ) dispatch_order.push([]); // special case: there is no dependent assignments.
				for (let order = dispatch_order.length-1; order > 0; order--) {
					const assgmtArrayIdxs = dispatch_order[order];
					const previousArrayIdxs = dispatch_order[order-1];
					const assgmtDBIdxs = assgmtArrayIdxs.map(i => parseInt(insertedPromiseIds[i]) );
					const previousDBIdxs = previousArrayIdxs.map(i => parseInt(insertedPromiseIds[i]));
					const statusPrecedent = (order-1) === 0 ?  ASSIGNMENT_STATUS.TO_DISPATCH : 'not_ready_to_dispatch';
					const updatePrecedentAssignments = previousDBIdxs.map(id => databaseServices.assignments.update_byId(id,{'next_assignments': assgmtDBIdxs,
																															 'status': statusPrecedent }
																														));
					const updateDependentAssignments = assgmtDBIdxs.map(id => databaseServices.assignments.update_byId(id,{'depend_on_assignments':previousDBIdxs}));
					updatePromises = updatePromises.concat([...updateDependentAssignments, ...updatePrecedentAssignments]);
				}
			} else {
				updatePromises = insertedPromiseIds.map(id => databaseServices.assignments.update_byId(id,{status: ASSIGNMENT_STATUS.TO_DISPATCH}));
			}

			return Promise.all(updatePromises)
			.then(()=>{
				const statusUpdatePromises = assigmentInputs.map( input => 
					databaseServices.service_requests.update_byId(serviceRequest.id, {assignment_dispatched: true})
					.then(() =>  databaseServices.agents.update('id', input.agentId, {status:AGENT_STATUS.BUSY}))
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
