// Services imports
const databaseServices = require('../../services/database/database_services.js')
const MapResponseHandler = require('./microservice_map_result')
const pathplannerResponseHandler = require('./microservice_assignment_result.js');
const { logData } = require('../../modules/systemlog.js');
const { SERVICE_DOMAINS } = require('../../modules/data_models.js');


async function processMicroserviceResponse(partialServiceRequest){
	
	const serviceRequest =  await databaseServices.service_requests.get_byId(partialServiceRequest.id);
	const workProcess = await databaseServices.work_processes.get_byId(serviceRequest.work_process_id);
	const services = await databaseServices.services.get('service_type', serviceRequest.service_type, ['class']);
	const serviceClass = services[0].class;

	if (serviceRequest.result){
		serviceRequest.response = serviceRequest.result; // temporary
	}
	const responseData = serviceRequest.response;
	
	let resultPromises = [];
	switch (serviceClass){
		case SERVICE_DOMAINS.STORAGE_SERVER:
			// databaseServices.yards.update_byId(yardId, data); 
			break;

		case SERVICE_DOMAINS.MAP_SERVER:
			let resultArray = responseData.results ? responseData.results:[responseData.result];
			const mapResult = resultArray[0];
			const yardId = workProcess.yard_id;
			if (mapResult.update) { resultPromises.push(MapResponseHandler.updateMap(yardId, mapResult.update))};
			if (mapResult.create) { resultPromises.push(MapResponseHandler.creaetMap(yardId, mapResult.create))};
			break;

		case 'Path planner':
			resultPromises.push(pathplannerResponseHandler.createAssignment(workProcess, responseData, serviceRequest));				
			break;

		case SERVICE_DOMAINS.ASSIGNMENT_PLANNER:
			resultPromises.push(pathplannerResponseHandler.createAssignment(workProcess, responseData, serviceRequest));				
			break;

	default:
		console.log("!!! service class is not supported yet !!!", serviceClass );
	}
	return Promise.all(resultPromises)
		   .catch(err => logData.addLog('microservice', serviceRequest, 'error', `processMicroserviceResponse ${err.message}`));
}




module.exports.processMicroserviceResponse = processMicroserviceResponse;