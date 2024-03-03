const databaseServices = require('../services/database/database_services.js');

/**
* generateFullYardContext
**
helyOS automatically send the yard state to external services as a context.
generateFullYardContext() gathers all data relative to the yard.
This data may not be used for all type of services. For this,
filterContext() filters the generated context data according to the requirements of the requested service.
*/
function generateFullYardContext(yardId){
	const context = {
					map: new Object(),
					agents: new Object(),
					}

	context.map.id = parseInt(yardId);
	return databaseServices.yards.get_byId(yardId, ['lon', 'lat', 'alt', 'map_data'])
	.then((yard) => {
		context.map.origin = new Object();
		context.map.origin.long = yard.lon;
		context.map.origin.lat  = yard.lat;
		context.map.origin.alt  = yard.alt;
		context.map.map_data  = yard.map_data;
		context.map.data_format = yard.data_format;
		return databaseServices.map.select({ 'yard_id': yardId, 'deleted_at': null});
	})
	.then((map_objects) => {
			context.map.map_objects = map_objects;
			agentFields = ['id', 'uuid', 'agent_class', 'agent_type', 'connection_status', 'geometry', 'name', 'message_channel', 'public_key', 'is_actuator', 'data_format',
							'yard_id', 'protocol', 'operation_types', 'factsheet', 'x', 'y', 'z','unit', 'orientations', 'sensors', 'resources']
			return  databaseServices.agents.get('yard_id', yardId,agentFields, null, ['interconnections']); // return selected fields plus the interconnected tools
	})
	.then((agents) => {	
		for (i=0; i < agents.length; i++){
			agents[i].pose = {
				x: agents[i].x,
				y: agents[i].y,
				z: agents[i].z,
				orientations: agents[i].orientations
			}
		}
		context.agents = agents;
		// context.tools = agents; //Deprecated
		return context;
	});
}


const filterContext = (context, filter) => {
	const filteredContext = {}
	if(filter.require_map_data) {
		filteredContext.map = context.map;
	}

	if(filter.require_agents_data) {
		filteredContext.agents = context.agents;
	} else {
		if (filter.require_mission_agents_data) {
			filteredContext.agents = context.agents.filter(t =>  filter.agent_ids.some(id => id == t.id));
		}
	}
	filteredContext.tools = filteredContext.agents; //Deprecated
    return filteredContext;
}


function generateMicroserviceDependencies(servReqUids){
	return databaseServices.service_requests.list_in('request_uid', servReqUids)
	.then( serviceRequests => {
		const dependencies = serviceRequests.map( serviceRequest => {
					const dependencyResults = {requestUid: serviceRequest.request_uid, step: serviceRequest.step, response: {} }
					dependencyResults['response'] = serviceRequest.response;
					if (serviceRequest.response && serviceRequest.response.result) {
						dependencyResults['response']['results'] = serviceRequest.response.result;
					}
					if (serviceRequest.response && serviceRequest.response.results) {
						dependencyResults['response']['results'] = serviceRequest.response.results;
					}

					return dependencyResults;
		});

		return dependencies;
	});


}



module.exports.generateFullYardContext =  generateFullYardContext;
module.exports.generateMicroserviceDependencies =  generateMicroserviceDependencies;
module.exports.filterContext =  filterContext;
