
const InMemorySensorTable = {};
const databaseServices = require('../../services/database/database_services');
const {inMemDB} = require('../../services/in_mem_database/mem_database_service');
const webSocketCommunicaton = require('../../modules/communication/web_socket_communication');
const { logData } = require('../../modules/systemlog.js');



async function yardAutoUpdate(objMsg, uuid) {
    
    // OBJECT UPDATE
    let objUpdate = {id: objMsg.body['id'], ...objMsg};
    objUpdate['last_message_time'] = new Date();


    if (objMsg.body && objMsg.body.map_object) {
        return inMemDB.update('map_objects','id', objMsg.body.map_object, new Date());
    }

    if (objMsg.body && objMsg.body.map_objects) {
        return objMsg.body.map_objects.map(map_object => {
                    inMemDB.update('map_objects','id', map_object, new Date());
                });
    }
          
}


module.exports.yardAutoUpdate = yardAutoUpdate;
