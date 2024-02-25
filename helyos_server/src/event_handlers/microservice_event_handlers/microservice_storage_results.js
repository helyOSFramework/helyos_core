// Services imports
const databaseServices = require('../../services/database/database_services.js')

// ----------------------------------------------------------------------------
// Work Process => Work Process Type Definitions => Service Request(s) => Storage update(s)
// ----------------------------------------------------------------------------


function updateMap(mapObject){
	return databaseServices.yards.update_byId( mapObject['id'], mapObject); 
}


function mapCreate(mapObject){

	
}




module.exports.mapCreate = mapCreate;
module.exports.updateMap = updateMap;
