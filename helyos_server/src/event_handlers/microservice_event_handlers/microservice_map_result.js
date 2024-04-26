// Services imports
const databaseServices = require('../../services/database/database_services.js')
var utils = require('../../modules/utils');
const { logData } = require('../../modules/systemlog.js');

// ----------------------------------------------------------------------------
// Work Process => Work Process Type Definitions => Service Request(s) => Map Update(s)
// ----------------------------------------------------------------------------

const insertManyMapObjectsAsync = (yardId, mapObjects) => {
	const responsePromise = mapObjects.map(mapObj => {
		// Filter only valid properties
		const _mapObj = (({data_format, type, metadata, data, name}) => ({data_format, type, metadata, data, name}))(mapObj);
		return databaseServices.map.insert({..._mapObj, yard_id: yardId});
	}); 

	return Promise.all(responsePromise);
}




// Delete all updated objects connected to the yard and create new objects using the mapObject data.
function updateMap(yardId, yardData){

	let mapObjects = yardData.map_objects || yardData.mapObjects;
	mapObjects = mapObjects?  mapObjects : [];
	mapObjects = mapObjects.map(mapObj => utils.snakeCaseAttributes(mapObj));

	let mapOrigin = yardData.origin? yardData.origin: null;
	let mapData =  yardData.map_data || yardData.mapData || null;

	const responsePromise = [];
	if (mapObjects.length > 0) {
		responsePromise.push(databaseServices.map.update('yard_id', yardId,  {'deleted_at': new Date()})
							.then( () => insertManyMapObjectsAsync(yardId, mapObjects))
							.catch((e)=> logData.addLog('microservice', {yardId}, 'error', `updating map objects: ${JSON.stringify(e)}` ))); 
	}

	if (mapOrigin){
		responsePromise.push(databaseServices.yards.update_byId(yardId, {lat: mapOrigin.lat, lon: mapOrigin.lon || mapOrigin.long, alt: mapOrigin.alt, source: 'microservice'})
							.catch((e)=> logData.addLog('microservice', {yardId}, 'error', `updating map origin: ${JSON.stringify(e)}` ))); 
	}
	if (mapData){
		responsePromise.push(databaseServices.yards.update_byId(yardId, {map_data: mapData, source: 'microservice'})
							.catch((e)=> logData.addLog('microservice', {yardId}, 'error', `updating map_data: ${JSON.stringify(e)}` ))); 

	}


	return Promise.all(responsePromise);
}



function mapCreate(yardData){

	console.log("yard creation by microservices is not implemented...")
	
}




module.exports.mapCreate = mapCreate;
module.exports.updateMap = updateMap;
