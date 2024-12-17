
const InMemorySensorTable = {};
const databaseServices = require('../../services/database/database_services');
const {inMemDB} = require('../../services/in_mem_database/mem_database_service');
const webSocketCommunicaton = require('../../modules/communication/web_socket_communication');
const { logData } = require('../../modules/systemlog.js');
const bufferNotifications = webSocketCommunicaton.bufferNotifications;



async function yardAutoUpdate(objMsg, uuid, bufferPeriod=0) {
    let mapObjectsPatchs = []

    if (objMsg.body && objMsg.body.map_objects) {
        if (!Array.isArray(objMsg.body.map_objects)) {
            logData.addLog('agent', {}, 'error', 'yard visualization: map_objects must be an array');
            return;
        }
        mapObjectsPatchs = objMsg.body.map_objects;
    }

    if (objMsg.body && objMsg.body.map_object) {
        mapObjectsPatchs.push(objMsg.body.map_object)
    }
    console.log(mapObjectsPatchs)
    try {
        await mapObjectsPatchs.forEach( async mObj => {

            let objUpdate = {id: mObj['id'], ...mObj};
            objUpdate['last_message_time'] = new Date();
        
            // Check the map object id only once and save in in-memory table.
            if (!inMemDB.map_objects[mObj['id']] ){
                const mapObject = await databaseServices.map_objects.get_byId(mObj['id']);
                if (!mapObject) {
                    logData.addLog('agent', {uuid}, 'error', `agent is trying to update inexistent map object: ${mObj.id}`);
                    inMemDB.update('map_objects', 'id', {id: mObj['id'] }, objUpdate['last_message_time'] + 10000); // try again in 10 seconds
                    return;
                }
            }
        
            inMemDB.update('map_objects','id', objUpdate, objUpdate.last_message_time);
        });
    
        inMemDB.flush('map_objects', 'id', databaseServices.map_objects, 0);
        console.log("flushed", mapObjectsPatchs)
        
    } catch (error) {
        logData.addLog('agent', {}, 'error', error.message);
    }
    


}



module.exports.yardAutoUpdate = yardAutoUpdate;
