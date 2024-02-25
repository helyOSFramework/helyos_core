/* This Source Code is subject to the terms of a modified Apache License Version 2.0.
** If a copy of the license was not distributed with this file, You can obtain one at http://github.com/helyosframework/helyos_core/. 
** Copyright 2022,  Fraunhofer-Institut für Verkehrs- und Infrastruktursysteme IVI.
*/

const databaseServices = require('../services/database/database_services.js');
const agentComm = require('./communication/agent_communication');
const systemlog = require('./systemlog');
const {SERVICE_STATUS, MISSION_STATUS} = require('./data_models');
const {generateFullYardContext, generateMicroserviceDependencies} = require('./microservice_context');
const {filterContext} = require('./microservice_context');
const saveLogData = systemlog.saveLogData;
const { v4: uuidv4 } = require('uuid');
const WAIT_AGENT_STATUS_PERIOD = parseInt(process.env.WAIT_AGENT_STATUS_PERIOD || '20')*1000;


const CLASS_PATH_PLANNER = 'Path planner'
// ----------------------------------------------------------------------------
// This section contains methods that map a work process to one or more service requests and then to assignments for robots.
// It is responsible for orchestrating the flow of work processes by generating the necessary service requests based on the work process type definitions.
// The generated service requests are sent to the microservices and their reponses are then used to assign tasks to robots.
// Work Process + Work Process Type Definitions => Service Request(s) => Assignment(s)
// ----------------------------------------------------------------------------


/**
 * ensureCorrectDummyRequestFormat
 * This method ensures the correct format for dummy requests.
 * Since that for a dummy service response = request, the request data
 * should have the format expected for a microservice response.
 * It returns a request with the correct format, by making a shallow copy of the request.
 * 
 * @param {object} service
 * @param {object} request
 * @param {array} agentIds
 */
ensureCorrectDummyRequestFormat = (service, request, agentIds) => {
	if (service.class === 'Assignment planner'){
		if (request.results && 
			request.results[0] && 
			(request.results[0].tool_id ||  // Deprecated
			 request.results[0].agent_id  || request.results[0].agent_uuid  )  &&
			(request.results[0].result || request.results[0].assignment) ){ // Correct format, do nothing:
			return {...request};
		} else { // Incorrect format? fix it:
			saveLogData('helyos_core', null, 'warn', `${service.name} is received a wrong request format, helyOS will try to fix it.`);
			const fixed_req = {request_id: null,
							   status: 'complete',
							   results: agentIds.map(id =>({agent_id: id, result: {...request}})) 
							  }
			return fixed_req;
		}
	}

	return request;
}

/**
 * 	createServiceRequestsForWorkProcessType
 *  This method returns an array of microservice requests for a given work process type.
 *  The method combines  information from the work process type definition and the service matrix.
 *  The returned array should be inserted in the service_requests table. Each row in service_requests table
 *  will be an input for a microservice call.
 * 
 * @param {string} processType 
 * @param {object} request 
 * @param {array} agentIds 
 * @param {number} wproc_id 
 * @returns serviceRequests
 */
function createServiceRequestsForWorkProcessType(processType, request, agentIds, wproc_id) {
	let _request = {...request}
	return databaseServices.services.select({'enabled': true})
	.then((services) => {
		// Step 1 Organize registered microservices by type, we consider only the services enabled by the developer.
		const serviceByType = {};
		services.forEach(s => serviceByType[s.service_type] = {url: s.service_url,
														 timeout: s.result_timeout, 
														 isDummy: s.is_dummy,
														 config: s.config,
														 class: s.class,
														 require_agents_data: s.require_agents_data,
														 require_mission_agents_data: s.require_mission_agents_data,
														 require_map_data: s.require_map_data
														 });

		// Step 2 Get the definition (or recipe) of the work process type, which includes the types of microservices that is emplyed by this mission.
		let workProcessDefinition;
		return databaseServices.work_process_type.get('name', processType)
		.then( query => {
			workProcessDefinition = query[0];
			if (!workProcessDefinition){
				const msg = `mission type is not defined: ${processType}`;
				saveLogData('helyos_core', {wproc_id:wproc_id}, 'error', msg);
				throw Error(msg)
			} 
			return databaseServices.work_process_service_plan.get('work_process_type_id', workProcessDefinition.id, [], 'step');
		})
		.then( planServiceSteps => {
								// const defaultWPSettings = workProcessDefinition.settings? workProcessDefinition.settings : {};
								// const _request = {...request, _settings: defaultWPSettings}

			// Step 3 The work process definition contains serveral steps, each step maps to one microservice request, they need to be ordered.
			const orderedSteps = planServiceSteps.sort((a,b) => b.request_order - a.request_order );
			const servicePlanToRequestsMap = orderedSteps.map( servStep => {
					if (!serviceByType[servStep.service_type]){
						const errMsg = `${servStep.service_type} microservice not found. Is it enabled?`;
						saveLogData('microservice', servStep, 'error', errMsg); 
						throw new Error(errMsg);
					}

					// The data format for mission request is arbitrary, except for missions using a dummy service.
					if (serviceByType[servStep.service_type].isDummy) {
						_request = ensureCorrectDummyRequestFormat(serviceByType[servStep.service_type], request, agentIds);
					}


					const extendedRequest = {
								'request_uid': uuidv4(),
								'step': servStep.step,
								'service_type': servStep.service_type,
								'service_url': serviceByType[servStep.service_type]['url'],
								'config': servStep.service_config || serviceByType[servStep.service_type]['config'],
								'result_timeout': serviceByType[servStep.service_type]['timeout'],
								'is_result_assignment': servStep.is_result_assignment,
								'wait_dependencies_assignments': servStep.wait_dependencies_assignments,
								'__request_order': servStep.request_order,
								'__depends_on_steps': servStep.depends_on_steps,
								'status' : 'ready_for_service',
								'request': _request,
								'require_agents_data': serviceByType[servStep.service_type]['require_agents_data'],
								'require_mission_agents_data': serviceByType[servStep.service_type]['require_mission_agents_data'],
								'require_map_data': serviceByType[servStep.service_type]['require_map_data'],
								'agent_ids': agentIds,
								'depend_on_requests': [],
								'next_request_to_dispatch_uids': [],
								'next_step':[] 
					};
					
					// COMMENT: If request_order is null or zero, the request will be held. ATM there is no mechanism to release it.
					if (!servStep.request_order || (servStep.depends_on_steps && servStep.depends_on_steps.length)) {
						extendedRequest['status'] = 'not_ready_for_service';
					}
					return extendedRequest;
			});
			//	

			// Step 4: Set depedencies between service requests.

			// If there is only one service request, return it.
			if (servicePlanToRequestsMap.length == 1) {
				const serviceRequests = servicePlanToRequestsMap; 
				delete serviceRequests[0]['__request_order'];
				delete serviceRequests[0]['__depends_on_steps'];
				return serviceRequests;
			}
		
			// Convert "__request_order" and "__depends_on_steps" to  "next_request_to_dispatch_uid" and "depend_on_requests".
			const serviceRequests = []; 
			for (let index = servicePlanToRequestsMap.length-1; index >= 0; index--) {
				const element = servicePlanToRequestsMap[index];
				
				// Set request sequence
				const request_order = element['__request_order'];
				const next_services = servicePlanToRequestsMap.filter(e => {
					return e['__request_order'] === (request_order+1);
				})
				if (next_services.length > 0) {
					element['next_request_to_dispatch_uid'] = next_services[0].request_uid;
					element['next_request_to_dispatch_uids'] = next_services.map(r => r.request_uid);
					element['next_step'] = next_services.map(r => r.step);
				}


				// Set request dependencies
				const dependences = element['__depends_on_steps']? element['__depends_on_steps']:[];
				const dependences_uids = dependences.map(step => {
						if (!(step && step.trim())) return '';
						const service = servicePlanToRequestsMap.filter(e => e.step.trim() === step.trim())[0];
						return service.request_uid;
				});
				element['depend_on_requests'] = dependences_uids;
				serviceRequests.push({...element});
			}

			serviceRequests.forEach( s => {
				delete s['__request_order'];
				delete s['__depends_on_steps'];
			});

			console.log("\n\n(1)=========  Create service requests for the process type "+ processType +" ==========" );
			console.log("service Requests from service matrix", serviceRequests);
			console.log("================================================================================");

			return serviceRequests;
		})
		.catch( e => {
			console.error("creating service requests: parsing data", e);
			throw new Error(e);
		});
	})
	.catch( e => {
		console.error("creating service requests: collecting data", e);
		throw new Error(e);
	});
			
	}




async function prepareServicesPipelineForWorkProcess(partialWorkProcess) {
	const workProcess = await databaseServices.work_processes.get_byId(partialWorkProcess.id);
	if (!workProcess.work_process_type_name) {
		saveLogData('microservice', {work_process_id: workProcess.id}, 'error', `work process type not found`);
		return databaseServices.work_processes.update_byId(workProcess.id, {'status': 'failed'});
	}

	let agentsListIds = workProcess['agent_ids'];

	if (workProcess.agent_uuids && workProcess.agent_uuids.length) {
		agentsListIds = await databaseServices.agents.getIds(workProcess.agent_uuids);
	} 

	// check if the ids in agentsListIds exist in the database
	if (agentsListIds && agentsListIds.length > 0) {
		const agents = await databaseServices.agents.list_in('id', agentsListIds);
		if (agents.length !== agentsListIds.length) {
			const errMsg = `Some agents in the work process ${workProcess.id} were not found in the database.`;
			saveLogData('microservice', {work_process_id: workProcess.id}, 'error', errMsg);
			return databaseServices.work_processes.update_byId(workProcess.id, {'status': 'failed'});
		}
	}
	
	let agentResponse; 
	// Append default work process settings to the request data as "_settings".
	const _settings = await databaseServices.work_process_type.get('name', workProcess['work_process_type_name'] )
							.then(r => {if (r.length && r[0].settings) return r[0].settings; else return {};});
	if (_settings) {
		if (workProcess.data) { 
			Object.assign(workProcess.data, { _settings: _settings });
		} else {
			workProcess.data =  { _settings: _settings }
		}
		await databaseServices.work_processes.update_byId(workProcess.id, {status: 'preparing resources', 'data': workProcess.data});					
	}
	//
		
	const logMetadata = {work_process_id: workProcess.id};
	if(!(workProcess.wait_free_agent===false) && agentsListIds && agentsListIds.length) {
			const missionAgents = await databaseServices.agents.list_in('id', agentsListIds );
			const missionAgentsToAckn =  missionAgents.filter(t => t.acknowledge_reservation);

			// Waiting agents to be "FREE"
				try {
					saveLogData('agent', logMetadata, 'normal', `waiting agent to be free`);	
					agentResponse = await agentComm.waitAgentStatusForWorkProcess(agentsListIds, 'FREE', null, WAIT_AGENT_STATUS_PERIOD)
					.catch( e => {throw e});
					agentsListIds.forEach(agentId => databaseServices.agents.update_byId(agentId, {work_process_id: null}));
					saveLogData('agent', logMetadata, 'normal', `agent is free`);	

				} catch (error) {
					saveLogData('agent', logMetadata, 'error', `expected free=${error}`);
					databaseServices.work_processes.update_byId(workProcess.id, {'status': 'failed'});
					console.log(error);
					return;
				}
			
			// Requesting "FREE" agents to be "READY"				
				await agentComm.sendGetReadyForWorkProcessRequest(agentsListIds, workProcess.id);
				missionAgents.forEach( agent => {
					logMetadata['uuid'] = agent.uuid;
					saveLogData('agent', logMetadata, 'normal', `requesting agent to be ready`);	
				});

			//  Waiting agents to acknowledge to be "READY"
				const waitReadyAcknListIds = missionAgentsToAckn.map( t => t.id);
				try {
					missionAgentsToAckn.forEach( agent => {
						logMetadata['uuid'] = agent.uuid;
						saveLogData('agent', logMetadata, 'normal', `waiting agent to be ready`);	
					});
					agentResponse = await agentComm.waitAgentStatusForWorkProcess(waitReadyAcknListIds, 'READY', workProcess.id,WAIT_AGENT_STATUS_PERIOD)
					.catch( e => {throw e});
					agentsListIds.forEach(agentId => databaseServices.agents.update_byId(agentId, {work_process_id: workProcess.id}));

					missionAgentsToAckn.forEach( agent => {
						logMetadata['uuid'] = agent.uuid;
						saveLogData('agent', logMetadata, 'normal', `agent is ready`);	
					});

				} catch (error) {
					const logMetadata = {wproc_id: workProcess.id};
					saveLogData('agent', logMetadata, 'error', `expected status ready: ${error}`);					
					databaseServices.work_processes.update_byId(workProcess.id, {'status': 'failed'});
					console.log(error);
					return;
				}

	}

	// COMMENT: Asynchronous block: Composing all service request calls at once.
	// Independent services triggered at the moment the mission is requested  
	// will have the same yard context. 
	// Only the context of DEPENDENT services (sequentially triggered) will be updated with the yard context.
	// This is a deliberate choice to ensure consistent context data between services starting in parallel.
	
	return generateFullYardContext(parseInt(workProcess['yard_id']))
	.then((context) => createServiceRequestsForWorkProcessType(workProcess['work_process_type_name'], workProcess['data'], agentsListIds, workProcess['id'])
		.then( requestList => {

				requestList.forEach(req => {
					req['work_process_id'] =  workProcess['id'];
					req['context'] = filterContext(context, req);
					req['context']['orchestration'] =  {'current_step': req['step'], 'next_step': req['next_step'] };
					req['request'] = JSON.stringify(req['request']); // postgress known issue: json column only saves arrays if inputed as string.
					databaseServices.service_requests.insert({...req, response: null,  fetched: false, processed: false});
				});
				databaseServices.work_processes.update_byId(workProcess.id, {'status': MISSION_STATUS.CALCULATING});
		})
	)
	.catch( e => {
		console.error("saving service requests:", e);
		databaseServices.work_processes.update('id',  workProcess['id'], {status: MISSION_STATUS.PLANNING_FAILED});
	});

}


/**
 * wrapUpMicroserviceCall
 * This method is called after a microservice response is received.
 * It checks if the work process is completed, i.e., if there any other requests to be dispatched or if there are any uncompleted assignments.
 * If the work process is completed, it updates the work process status to 'ASSIGNMENTS_COMPLETED'.
 * 
 * @param {object} partialServiceRequest
 * @returns {Promise<boolean>}
**/
function wrapUpMicroserviceCall(partialServiceRequest) {
	if (partialServiceRequest.next_request_to_dispatch_uid) {
		return Promise.resolve(false);
	}

	return databaseServices.getUncompletedAssignments_byWPId(partialServiceRequest.work_process_id)
		.then(uncompleteAssgms => {
			if (partialServiceRequest.service_type === CLASS_PATH_PLANNER && partialServiceRequest.is_result_assignment) {
				return Promise.resolve(true); // Do nothing and wait for the assignment conclusion to mark the workprocess completed.
			}

			if (uncompleteAssgms.length === 0) {
				return databaseServices.work_processes.update_byId(partialServiceRequest.work_process_id, { status: MISSION_STATUS.ASSIGNMENTS_COMPLETED });
			} else {
				return Promise.resolve(true); // Do nothing and wait for the assignment conclusion to mark the workprocess completed.
			}
		});

}

/**
 * updateRequestData
 * It updates the user request data of a service request with the response.orchestration data of the previous service request.
 * If the response.orchestration.next_step_request is not defined, it returns the original user request.
 * 
 * @param {*} serviceResponses 
 * @param {*} nextServRequest 
 * @returns 
 */
function updateRequestData(serviceResponses, nextServRequest) {
	const newRequest = serviceResponses.filter(serviceResponse => {
		return (
			serviceResponse &&
			serviceResponse.orchestration &&
			serviceResponse.orchestration.next_step_request &&
			serviceResponse.orchestration.next_step_request[nextServRequest.step]
		);
	});

	if (newRequest.length === 0) {
		return nextServRequest.request;
	}
	if (newRequest.length > 1) {
		saveLogData('microservices', {}, 'error', 'two microservices are trying to change the request data of successive microservice.');
	}

	return newRequest[0].orchestration.next_step_request[nextServRequest.step];
}



function activateNextServicesInPipeline(partialServiceRequest) {
	if (!partialServiceRequest.next_request_to_dispatch_uid) { return Promise.resolve(0) };

	saveLogData('helyos_core', null, 'normal', `activate Next Services In Pipeline`);

	databaseServices.service_requests.get_byId(partialServiceRequest.id)
		.then(serviceRequest => {
			databaseServices.service_requests.list_in('request_uid', serviceRequest.next_request_to_dispatch_uids)
				.then(nextRequests => {
					const updatingPromises = nextRequests.map(nextServRequest => {
						if (nextServRequest.status !== SERVICE_STATUS.NOT_READY) { return Promise.resolve(0); }

						return isRequestReadyForService(nextServRequest)
							.then(isReadyForService => {
								if (isReadyForService) {
									nextServRequest.status = SERVICE_STATUS.READY_FOR_SERVICE;
								} else {
									nextServRequest.status = SERVICE_STATUS.WAIT_DEPENDENICIES;
								}
								return databaseServices.service_requests.update('request_uid', serviceRequest.next_request_to_dispatch_uid, nextServRequest);
							});

					});

					return Promise.all(updatingPromises);

				});
		})

}

async function updateRequestContext(servRequestId) {
	const serviceRequest = await databaseServices.service_requests.get_byId(servRequestId);
	// Yard Context
	const workProcess = await databaseServices.work_processes.get_byId(serviceRequest.work_process_id, ['yard_id']);
	const fullYardContext = await generateFullYardContext(workProcess.yard_id);
	const yardContext = filterContext(fullYardContext, serviceRequest);
	// Microservice dependencies
	const dependencies = await generateMicroserviceDependencies(serviceRequest.depend_on_requests);
	// Microservice request data updated
	const dependenciesResponses = dependencies.map(d => d.response);
	const requestData = updateRequestData(dependenciesResponses, serviceRequest);

	const context = { ...yardContext, 'dependencies': dependencies };
	context['orchestration'] = { 'current_step': serviceRequest['step'], 'next_step': serviceRequest['next_step'] };
	if (serviceRequest.context) { serviceRequest.context = {} }
	return databaseServices.service_requests.update_byId(serviceRequest.id, { request: requestData, context: { ...serviceRequest.context, ...context } });
}


/**
 * isRequestReadyForService
 * Check if a service request is ready to be sent to a microservice.
 * That is, if a service with `wait_dependencies` status can be turned to a `ready for service`.
 * A service request is ready if all its dependencies are completed. 
 */ 
const isRequestReadyForService = async (serviceRequest) => {
	const completed_wp_requests = await databaseServices.service_requests.select(
		{ work_process_id: serviceRequest.work_process_id, status: SERVICE_STATUS.READY },
		['id', 'request_uid']
	);

	const completed_wp_requests_uids = completed_wp_requests.map(r => r.request_uid);
	const remain_dependencies = serviceRequest.depend_on_requests.filter(el => !completed_wp_requests_uids.includes(el)); 

	if (remain_dependencies.length > 0) {
		return false;
	}
	
	if (!serviceRequest.wait_dependencies_assignments) {
		return true;
	}

	const requestDeps = completed_wp_requests.filter(e => serviceRequest.depend_on_requests.includes(e.request_uid));
	const dependencies_assignments = await databaseServices.assignments.list_in('service_request_id', requestDeps.map(r => r.id));
	const remain_assignments = dependencies_assignments.filter(assgm => !(assgm.status === 'completed' || assgm.status === 'succeeded'));

	if (remain_assignments.length > 0) {
		return false;
	}

	return true;
}

module.exports.prepareServicesPipelineForWorkProcess = prepareServicesPipelineForWorkProcess;
module.exports.updateRequestContext = updateRequestContext;
module.exports.activateNextServicesInPipeline = activateNextServicesInPipeline;
module.exports.wrapUpMicroserviceCall = wrapUpMicroserviceCall;
module.exports.isRequestReadyForService = isRequestReadyForService;