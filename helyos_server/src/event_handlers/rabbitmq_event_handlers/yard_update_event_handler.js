
const InMemorySensorTable = {};
const databaseServices = require('../../services/database/database_services');
const {inMemDB} = require('../../services/in_mem_database/mem_database_service');
const webSocketCommunicaton = require('../../modules/communication/web_socket_communication');
const { logData } = require('../../modules/systemlog.js');
const bufferNotifications = webSocketCommunicaton.bufferNotifications;



async function yardAutoUpdate(objMsg, uuid, bufferPeriod=0) {
    
    // OBJECT UPDATE
    let objUpdate = {id: objMsg['id'], ...objMsg};
    objUpdate['last_message_time'] = new Date();

    // Check the map object id only once and save in in-memory table.
    if (!inMemDB.map_objects[objMsg['id']] ){
        const mapObject = await databaseServices.map.get_byId(objMsg['id']);
        if (!mapObject) {
            logData.addLog('agent', {uuid}, 'error', `agent is trying to update inexistent map object: ${objMsg.id}`);
            inMemDB.update('map_objects', 'id', {id: objMsg['id'] }, objUpdate['last_message_time'] + 10000); // try again in 10 seconds
            return;
        }
    }

    inMemDB.update('map_objects','id', objUpdate, objUpdate.last_message_time);
    return inMemDB.flush('map_objects', 'id', databaseServices.map_objects, bufferPeriod);
}



module.exports.yardAutoUpdate = yardAutoUpdate;
