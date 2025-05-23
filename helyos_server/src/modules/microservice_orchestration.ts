/* This Source Code is subject to the terms of a modified Apache License Version 2.0.
** If a copy of the license was not distributed with this file, You can obtain one at http://github.com/helyosframework/helyos_core/. 
** Copyright 2022,  Fraunhofer-Institut für Verkehrs- und Infrastruktursysteme IVI.
*/

import * as DatabaseService from '../services/database/database_services';
import agentComm from './communication/agent_communication';
import { logData } from './systemlog';
import config from '../config';
const { WAIT_AGENT_STATUS_PERIOD } = config;

import { SERVICE_STATUS, MISSION_STATUS, UNCOMPLETE_MISSION_STATUS, 
        ON_ASSIGNMENT_FAILURE_ACTIONS, SERVICE_DOMAINS, 
        UNCOMPLETED_SERVICE_STATUS } from './data_models';

import { generateFullYardContext, generateMicroserviceDependencies, filterContext } from './microservice_context';
import { v4 as uuidv4 } from 'uuid';

const CLASS_PATH_PLANNER = SERVICE_DOMAINS.ASSIGNMENT_PLANNER;
// ----------------------------------------------------------------------------
// This section contains methods that map a work process to one or more service requests and then to assignments for robots.
// It is responsible for orchestrating the flow of work processes by generating the necessary service requests based on the work process type definitions.
// The generated service requests are sent to the microservices and their reponses are then used to assign tasks to robots.
// Work Process + Work Process Type Definitions => Service Request(s) => Assignment(s)
// ----------------------------------------------------------------------------

interface Service {
    class: string;
    name: string;
}

interface Request {
    results?: Array<{ tool_id?: string; agent_id?: string; agent_uuid?: string; result?: any; assignment?: any }>;
    [key: string]: any;
}

interface Agent {
    id: string;
    uuid?: string;
    acknowledge_reservation?: boolean;
}

interface PartialWorkProcess {
    id: number;
    work_process_type_name?: string;
    agent_ids?: string[];
    agent_uuids?: string[];
    on_assignment_failure?: string;
    fallback_mission?: string;
    wait_free_agent?: boolean;
    operation_types_required?: string[];
    data?: any;
    [key: string]: any;
}

interface PartialServiceRequest {
    id: number;
    work_process_id: number;
    next_request_to_dispatch_uids?: string[];
    status: string;
    service_type: string;
    is_result_assignment?: boolean;
    step: string;
    [key: string]: any;
    request: any;
}


interface ServiceResponse {
    results?: any;
    orchestration?: {
        next_step_request?: Record<string, any>;
        allow_dependent_steps?: string[];
    };
}

interface NextServRequest {
    step: string;
    request: any;
}


/**
 * ensureCorrectDummyRequestFormat
 * This method ensures the correct format for dummy requests.
 * Since that for a dummy service response = request, the request data
 * should have the format expected for a microservice response.
 * It returns a request with the correct format, by making a shallow copy of the request.
 * 
 * @param {Service} service
 * @param {Request} request
 * @param {string[]} agentIds
 * @returns {Request}
 */
function ensureCorrectDummyRequestFormat(service: Service, request: Request, agentIds: string[]): Request {
    if (service.class === SERVICE_DOMAINS.ASSIGNMENT_PLANNER) {
        if (request.results &&
            request.results[0] &&
            (request.results[0].tool_id ||  // Deprecated
                request.results[0].agent_id || request.results[0].agent_uuid) &&
            (request.results[0].result || request.results[0].assignment)) { // Correct format, do nothing:
            return { ...request };
        } else { // Incorrect format? fix it:
            logData.addLog('helyos_core', null, 'warn', `${service.name} is received a wrong request format, helyOS will try to fix it.`);
            const fixed_req = {
                request_id: null,
                status: 'complete',
                results: agentIds.map(id => ({ agent_id: id, assignment: { ...request } }))
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
 * @param {Request} request 
 * @param {string[]} agentIds 
 * @param {number} wproc_id 
 * @returns {Promise<any[]>}
 */
function createServiceRequestsForWorkProcessType(processType: string, request: Request, agentIds: string[], wproc_id: number): Promise<any[]> {
    let _request = { ...request };
    return DatabaseService.getInstance()
    .then( databaseServices => databaseServices.services.select({ 'enabled': true })
        .then((services) => {
            // Step 1 Organize registered microservices by type, we consider only the services enabled by the developer.
            const serviceByType: Record<string, any> = {};
            services.forEach(s => serviceByType[s.service_type] = {
                url: s.service_url,
                timeout: s.result_timeout,
                isDummy: s.is_dummy,
                config: s.config,
                class: s.class,
                require_agents_data: s.require_agents_data,
                require_mission_agents_data: s.require_mission_agents_data,
                require_map_data: s.require_map_data,
                require_map_objects: s.require_map_objects
            });

            // Step 2 Get the definition (or recipe) of the work process type, which includes the types of microservices that is emplyed by this mission.
            let workProcessDefinition: any;
            return databaseServices.work_process_type.get('name', processType)
                .then(query => {
                    workProcessDefinition = query[0];
                    if (!workProcessDefinition) {
                        const msg = `mission type is not defined: ${processType}`;
                        logData.addLog('helyos_core', { wproc_id: wproc_id }, 'error', msg);
                        throw Error(msg)
                    }
                    return databaseServices.work_process_service_plan.get('work_process_type_id', workProcessDefinition.id, [], 'step');
                })
                .then(planServiceSteps => {
                    // const defaultWPSettings = workProcessDefinition.settings? workProcessDefinition.settings : {};
                    // const _request = {...request, _settings: defaultWPSettings}

                    // Step 3 The work process definition contains serveral steps, each step maps to one microservice request, they need to be ordered.
                    const orderedSteps = planServiceSteps.sort((a, b) => b.request_order - a.request_order);
                    const servicePlanToRequestsMap = orderedSteps.map(servStep => {
                        if (!serviceByType[servStep.service_type]) {
                            const errMsg = `${servStep.service_type} microservice not found. Is it enabled?`;
                            logData.addLog('microservice', servStep, 'error', errMsg);
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
                            'status': SERVICE_STATUS.READY_FOR_SERVICE,
                            'request': _request,
                            'require_agents_data': serviceByType[servStep.service_type]['require_agents_data'],
                            'require_mission_agents_data': serviceByType[servStep.service_type]['require_mission_agents_data'],
                            'require_map_data': serviceByType[servStep.service_type]['require_map_data'],
                            'require_map_objects': serviceByType[servStep.service_type]['require_map_objects'],
                            'agent_ids': agentIds,
                            'depend_on_requests': [],
                            'next_request_to_dispatch_uids': [],
                            'next_step': []
                        };

                        // COMMENT: If request_order is null or zero, the request will be held. ATM there is no mechanism to release it.
                        if (!servStep.request_order || (servStep.depends_on_steps && servStep.depends_on_steps.length)) {
                            extendedRequest['status'] = SERVICE_STATUS.NOT_READY;
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
                    const serviceRequests: any[] = [];
                    for (let index = servicePlanToRequestsMap.length - 1; index >= 0; index--) {
                        const element = servicePlanToRequestsMap[index];

                        // Set request sequence
                        const request_order = element['__request_order'];
                        const next_services = servicePlanToRequestsMap.filter(e => {
                            return e['__request_order'] === (request_order + 1);
                        })
                        if (next_services.length > 0) {
                            element['next_request_to_dispatch_uid'] = next_services[0].request_uid;
                            element['next_request_to_dispatch_uids'] = next_services.map(r => r.request_uid) as any;
                            element['next_step'] = next_services.map(r => r.step) as any;
                        }


                        // Set request dependencies
                        const dependences = element['__depends_on_steps'] ? element['__depends_on_steps'] : [];
                        const dependences_uids = dependences.map(step => {
                            if (!(step && step.trim())) return '';
                            const service = servicePlanToRequestsMap.filter(e => e.step.trim() === step.trim())[0];
                            return service.request_uid;
                        });
                        element['depend_on_requests'] = dependences_uids;
                        serviceRequests.push({ ...element });
                    }

                    serviceRequests.forEach(s => {
                        delete s['__request_order'];
                        delete s['__depends_on_steps'];
                    });

                    console.log("\n\n=========  Preparing microservice requests for the process type " + processType + " ==========");
                    serviceRequests.forEach(s => {
                        console.log(`Request UID: ${s.request_uid}`);
                        console.log(`Step: ${s.step}`);
                        console.log(`Service Type: ${s.service_type}`);
                        console.log(`Service URL: ${s.service_url}`);
                        console.log(`Next Request UID: ${s.next_request_to_dispatch_uids}`);
                        console.log("--------------------");
                    });
                    console.log("================================================================================");

                    return serviceRequests;
                })
                .catch(e => {
                    console.error("creating service requests: parsing data", e);
                    throw new Error(e);
                });
        }))
    .catch(e => {
        console.error("creating service requests: collecting data", e);
        throw new Error(e);
    });

}

/**
 * prepareServicesPipelineForWorkProcess
 * Prepares the services pipeline for a given work process.
 * 
 * @param {PartialWorkProcess} partialWorkProcess
 * @returns {Promise<void>}
 */
async function prepareServicesPipelineForWorkProcess(partialWorkProcess: PartialWorkProcess): Promise<any> {
    const databaseServices = await DatabaseService.getInstance();
    const workProcess = await databaseServices.work_processes.get_byId(partialWorkProcess.id);
    if (!workProcess.work_process_type_name) {
        logData.addLog('microservice', { work_process_id: workProcess.id }, 'error', `work process type not found`);
        return databaseServices.work_processes.update_byId(workProcess.id, { 'status': MISSION_STATUS.FAILED });
    }

    let agentsListIds = workProcess['agent_ids'];

    if (workProcess.agent_uuids && workProcess.agent_uuids.length) {
        agentsListIds = await databaseServices.agents.getIds(workProcess.agent_uuids);
    }

    // Check if the ids in agentsListIds exist in the database
    if (agentsListIds && agentsListIds.length > 0) {
        const agents = await databaseServices.agents.list_in('id', agentsListIds);
        if (agents.length !== agentsListIds.length) {
            const errMsg = `Some agents in the work process ${workProcess.id} were not found in the database.`;
            logData.addLog('microservice', { work_process_id: workProcess.id }, 'error', errMsg);
            return databaseServices.work_processes.update_byId(workProcess.id, { 'status': MISSION_STATUS.FAILED });
        }
    }

    // Collect information from mission recipe.
    const recipe = await databaseServices.work_process_type.get('name', workProcess['work_process_type_name']).then(r => r.length ? r[0] : {});

    // Behaviour upon failure
    if (workProcess.on_assignment_failure == ON_ASSIGNMENT_FAILURE_ACTIONS.DEFAULT || workProcess.on_assignment_failure == null) {
        await databaseServices.work_processes.update_byId(workProcess.id, { on_assignment_failure: recipe.on_assignment_failure });
    }
    // Mission after failure
    if (workProcess.fallback_mission == ON_ASSIGNMENT_FAILURE_ACTIONS.DEFAULT) {
        await databaseServices.work_processes.update_byId(workProcess.id, { fallback_mission: recipe.fallback_mission });
    }

    // Append default work process settings to the request data as "_settings".
    if (recipe.settings) {
        if (workProcess.data) {
            Object.assign(workProcess.data, { _settings: recipe.settings });
        } else {
            workProcess.data = { _settings: recipe.settings }
        }
        await databaseServices.work_processes.update_byId(workProcess.id, { status: MISSION_STATUS.PREPARING, 'data': workProcess.data });
    }
    //


    let agentResponse;
    const logMetadata = { work_process_id: workProcess.id };
    if (!(workProcess.wait_free_agent === false) && agentsListIds && agentsListIds.length) {
        const missionAgents = await databaseServices.agents.list_in('id', agentsListIds);

        // Waiting agents to be "FREE"
        try {
            logData.addLog('agent', logMetadata, 'info', `waiting agent to be free`);
            agentResponse = await agentComm.waitAgentStatusForWorkProcess(agentsListIds, 'FREE', null, WAIT_AGENT_STATUS_PERIOD);
            await Promise.all(agentsListIds.map(agentId => databaseServices.agents.update_byId(agentId, { work_process_id: null })));

            logData.addLog('agent', logMetadata, 'info', `agent is free`);

        } catch (error) {
            logData.addLog('agent', logMetadata, 'error', `expected free=${error}`);
            databaseServices.work_processes.update_byId(workProcess.id, { 'status': MISSION_STATUS.FAILED });
            console.log(error);
            return;
        }

        // Requesting "FREE" agents to be "READY"				
        await agentComm.sendGetReadyForWorkProcessRequest(agentsListIds, workProcess.id, workProcess.operation_types_required);
        missionAgents.forEach(agent => {
            logMetadata['uuid'] = agent.uuid;
            logData.addLog('agent', logMetadata, 'info', `requesting agent to be ready`);
        });

        //  Waiting agents to acknowledge to be "READY"
        const missionAgentsToAckn = missionAgents.filter(t => t.acknowledge_reservation);
        const waitReadyAcknListIds = missionAgentsToAckn.map(t => t.id);
        try {
            missionAgentsToAckn.forEach(agent => {
                logMetadata['uuid'] = agent.uuid;
                logData.addLog('agent', logMetadata, 'info', `waiting agent to be ready`);
            });
            agentResponse = await agentComm.waitAgentStatusForWorkProcess(waitReadyAcknListIds, 'READY', workProcess.id, WAIT_AGENT_STATUS_PERIOD);
            await Promise.all(agentsListIds.map(agentId => databaseServices.agents.update_byId(agentId, { work_process_id: workProcess.id })));

            missionAgentsToAckn.forEach(agent => {
                logMetadata['uuid'] = agent.uuid;
                logData.addLog('agent', logMetadata, 'info', `agent is ready`);
            });

        } catch (error) {
            const logMetadata = { wproc_id: workProcess.id };
            logData.addLog('agent', logMetadata, 'error', `expected status ready: ${error}`);
            databaseServices.work_processes.update_byId(workProcess.id, { 'status': MISSION_STATUS.FAILED });
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
            .then(requestList => {

                const insertPromisses = requestList.map(req => {
                    req['work_process_id'] = workProcess['id'];
                    req['context'] = filterContext(context, req);
                    req['context']['orchestration'] = { 'current_step': req['step'], 'next_step': req['next_step'] };
                    req['request'] = JSON.stringify(req['request']); // postgress known issue: json column only saves arrays if inputed as string.
                    return databaseServices.service_requests.insert({ ...req, response: null, fetched: false, processed: false });
                });

                return Promise.all(insertPromisses)
                    .then(() => databaseServices.work_processes.updateByConditions(
                        {
                            'id': workProcess['id'], 'status__in': [MISSION_STATUS.PREPARING,
                            MISSION_STATUS.DISPATCHED,
                            MISSION_STATUS.EXECUTING]
                        },
                        { 'status': MISSION_STATUS.CALCULATING })
                    );
            })
        )
        .catch(e => {
            console.error("saving service requests:", e);
            databaseServices.work_processes.update('id', workProcess['id'], { status: MISSION_STATUS.PLANNING_FAILED });
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
async function wrapUpMicroserviceCall(partialServiceRequest: PartialServiceRequest): Promise<boolean> {
    const databaseServices = await DatabaseService.getInstance();
	if (partialServiceRequest.next_request_to_dispatch_uids &&
	  partialServiceRequest.next_request_to_dispatch_uids.length) {
	  return Promise.resolve(false);
	}
	if (partialServiceRequest.status === SERVICE_STATUS.SKIPPED) {
	  return Promise.resolve(false);
	}
  
	const uncompleteAssgms = await databaseServices.getUncompletedAssignments_byWPId(partialServiceRequest.work_process_id);
  
	if (partialServiceRequest.service_type === CLASS_PATH_PLANNER && partialServiceRequest.is_result_assignment) {
	  return Promise.resolve(true); // Do nothing and wait for the assignment conclusion to mark the workprocess completed.
	}
  
	if (uncompleteAssgms.length === 0) {
	  const wproc = await databaseServices.work_processes.get_byId(partialServiceRequest.work_process_id, ['status']);
	  const isMissionStillUncompleted = UNCOMPLETE_MISSION_STATUS.includes(wproc.status);
  
	  const uncompleteServices = await databaseServices.service_requests.select({
		work_process_id: wproc.id,
		status__in: UNCOMPLETED_SERVICE_STATUS
	  });
  
	  if (isMissionStillUncompleted && !uncompleteServices.length) {
		await databaseServices.work_processes.updateByConditions({
		  id: partialServiceRequest.work_process_id,
		  status__in: [
			MISSION_STATUS.PREPARING,
			MISSION_STATUS.CALCULATING,
			MISSION_STATUS.EXECUTING
		  ]
		}, { status: MISSION_STATUS.ASSIGNMENTS_COMPLETED });
	  }
	} else {
	  return Promise.resolve(true); // Do nothing and wait for the assignment conclusion to mark the workprocess completed.
	}
  
	return Promise.resolve(false);
  }

/**
 * checkIfServiceShouldRun
 * Determines whether the next service request step should run based on the response data from previous service requests.
 * If the `orchestration.allow_dependent_steps` field is not defined in the response, it defaults to allowing the next step to run.
 * 
 * @param {*} serviceResponses 
 * @param {*} nextServRequest 
 * @returns 
 */
function checkIfServiceShouldRun(serviceResponses: ServiceResponse[], nextServRequest: NextServRequest): boolean {
	let runService = true;
	serviceResponses.forEach(serviceResponse => {
	  const enabled_step = serviceResponse &&
		serviceResponse.orchestration &&
		serviceResponse.orchestration.allow_dependent_steps ? serviceResponse.orchestration.allow_dependent_steps : null;
  
	  if (enabled_step !== null) {
		runService = runService && enabled_step.includes(nextServRequest.step);
	  }
	});
  
	return runService;
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
function updateRequestData(serviceResponses: ServiceResponse[], nextServRequest: NextServRequest): any {
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
	  logData.addLog('microservice', {}, 'error', 'two microservices are trying to change the request data of successive microservice.');
	}
  
	return newRequest[0].orchestration?.next_step_request?.[nextServRequest.step];
}



/**
 * Activates the next services in the pipeline.
 * @param partialServiceRequest Partial service request
 */
async function activateNextServicesInPipeline(partialServiceRequest: PartialServiceRequest): Promise<number> {
    const databaseServices = await DatabaseService.getInstance();

    if (!partialServiceRequest.next_request_to_dispatch_uids?.length) {
        return 0;
    }

    const workProcessStatus = await databaseServices.work_processes.get_byId(partialServiceRequest.work_process_id, ['status']);
    if (![MISSION_STATUS.PREPARING, MISSION_STATUS.EXECUTING, MISSION_STATUS.CALCULATING].includes(workProcessStatus.status)) {
        return 0;
    }

    logData.addLog('helyos_core', null, 'info', `Activate next services in pipeline, work process status is ${workProcessStatus.status}`);

    const serviceRequest = await databaseServices.service_requests.get_byId(partialServiceRequest.id);
    const nextRequests = await databaseServices.service_requests.list_in('request_uid', serviceRequest.next_request_to_dispatch_uids);

    const updatingPromises = nextRequests.map(async nextServRequest => {
        if (nextServRequest.status !== SERVICE_STATUS.NOT_READY) return 0;

        nextServRequest.status = await determineServiceRequestStatus(nextServRequest);
        return databaseServices.service_requests.update('request_uid', nextServRequest.request_uid, nextServRequest);
    });

    await Promise.all(updatingPromises);
    return 1;
}

/**
 * Updates the request context.
 * @param servRequestId Service request ID
 */
async function updateRequestContext(servRequestId: number): Promise<void> {
    const databaseServices = await DatabaseService.getInstance();

    const serviceRequest = await databaseServices.service_requests.get_byId(servRequestId);
    const workProcess = await databaseServices.work_processes.get_byId(serviceRequest.work_process_id, ['yard_id']);
    const fullYardContext = await generateFullYardContext(workProcess.yard_id);
    const yardContext = filterContext(fullYardContext, serviceRequest);
    const dependencies = await generateMicroserviceDependencies(serviceRequest.depend_on_requests);
    const dependenciesResponses = dependencies.map(d => d.response);
    const requestData = updateRequestData(dependenciesResponses, serviceRequest);

    const context = { ...yardContext, dependencies, orchestration: { current_step: serviceRequest.step, next_step: serviceRequest.next_step } };
    serviceRequest.context = serviceRequest.context || {};

    await databaseServices.service_requests.updateByConditions(
        { id: serviceRequest.id, status: SERVICE_STATUS.DISPATCHING_SERVICE },
        { request: requestData, context: { ...serviceRequest.context, ...context } }
    );
}

/**
 * determineServiceRequestStatus
 * Determines the status of a service request based on its dependencies.
 * A service request is considered ready for service if all its dependencies are completed.
 * If dependencies are not met, the service request status will reflect the appropriate state.
 * @param serviceRequest Service request
 * @returns Status of the service request
 */
async function determineServiceRequestStatus(serviceRequest: PartialServiceRequest): Promise<string> {
    const databaseServices = await DatabaseService.getInstance();

    const completedWpRequests = await databaseServices.service_requests.select(
        { work_process_id: serviceRequest.work_process_id, status: SERVICE_STATUS.READY },
        ['id', 'request_uid']
    );

    const completedWpRequestUids = completedWpRequests.map(r => r.request_uid);
    const remainDependencies = serviceRequest.depend_on_requests?.filter(el => !completedWpRequestUids.includes(el)) || [];

    if (remainDependencies.length > 0) {
        return SERVICE_STATUS.WAIT_DEPENDENCIES;
    }

    const dependencies = await generateMicroserviceDependencies(serviceRequest.depend_on_requests || []);
    const dependenciesResponses = dependencies.map(d => d.response);
    const shouldServiceRun = checkIfServiceShouldRun(dependenciesResponses, serviceRequest as NextServRequest);

    if (!shouldServiceRun) {
        return SERVICE_STATUS.SKIPPED;
    }

    if (!serviceRequest.wait_dependencies_assignments) {
        return SERVICE_STATUS.READY_FOR_SERVICE;
    }

    const requestDeps = completedWpRequests.filter(e => serviceRequest.depend_on_requests?.includes(e.request_uid));
    const dependenciesAssignments = await databaseServices.assignments.list_in('service_request_id', requestDeps.map(r => r.id));
    const remainAssignments = dependenciesAssignments.filter(assgm => !['completed', 'succeeded'].includes(assgm.status));

    if (remainAssignments.length > 0) {
        return SERVICE_STATUS.WAIT_DEPENDENCIES;
    }

    return SERVICE_STATUS.READY_FOR_SERVICE;
}

export {
	prepareServicesPipelineForWorkProcess,
	updateRequestContext,
	activateNextServicesInPipeline,
	wrapUpMicroserviceCall,
	determineServiceRequestStatus
};