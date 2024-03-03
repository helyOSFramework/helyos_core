// Services imports
const { AGENT_STATUS } = require('../../modules/data_models.js');
const { saveLogData } = require('../../modules/systemlog.js');
const databaseServices = require('../../services/database/database_services.js')

// ----------------------------------------------------------------------------
// Work Process => Work Process Type Definitions => Service Request(s) => Assignment(s)
// ----------------------------------------------------------------------------


async function createAssignment(workProcess, servResponse, serviceRequest){
	console.log("servResponse")
	console.log(servResponse)

	const agentIds = workProcess.agent_ids;
	const serviceRequestId = serviceRequest?  serviceRequest.id:null
	console.log("workProcess",workProcess)
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
				saveLogData('helyos_core', null, 'error', `Assignment planner did not return a valid agent_id or agent_uuid in the result.`);
				throw new Error(`Assignment planner did not return a valid agent_id or agent_uuid in the result.`);
			}

			if (!agentIds.includes(parseInt(agent_id))){
				saveLogData('helyos_core', null, 'error', `Assignment planner agent_id ${agent_id} was not defined in the work_process ${workProcess.id} agent_ids. In future versions, this will block the mission.`);
			}


			console.log()


			assigmentInputs.push({
				yard_id: yardId,
				work_process_id: workProcess.id,
				agent_id: agent_id, 
				service_request_id: serviceRequestId,
				status: 'not_ready_to_dispatch',
				start_time_stamp: start_stamp,
				data: JSON.stringify(result.result || result.assignment)});
		}
			
	} else {  // keep compatibility: in old versions of external services, one assigment is sent to all toolIds.
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
					const statusPrecedent = (order-1) === 0 ?  'to_dispatch' : 'not_ready_to_dispatch';
					const updatePrecedentAssignments = previousDBIdxs.map(id => databaseServices.assignments.update_byId(id,{'next_assignments': assgmtDBIdxs, status: statusPrecedent}));
					const updateDependentAssignments = assgmtDBIdxs.map(id => databaseServices.assignments.update_byId(id,{'depend_on_assignments':previousDBIdxs}));
					updatePromises = updatePromises.concat([...updateDependentAssignments, ...updatePrecedentAssignments]);
				}
			} else {
				updatePromises = insertedPromiseIds.map(id => databaseServices.assignments.update_byId(id,{status: 'to_dispatch'}));
			}

			Promise.all(updatePromises)
			.then(()=>{
				assigmentInputs.forEach( input => 
					databaseServices.service_requests.update_byId(serviceRequest.id, {assignment_dispatched: true})
					.then(() =>  databaseServices.agents.update('id', input.agentId, {status:AGENT_STATUS.BUSY}))
					.then(() =>  databaseServices.work_processes.update('id', workProcess.id, {status:'executing'}))
				);
			})

	});

}




module.exports.createAssignment = createAssignment;
