
const memDBService = require('../../services/in_mem_database/mem_database_service.js');
const { logData } = require('../../modules/systemlog.js');



async function yardAutoUpdate(objMsg, uuid) {
    const inMemDB = await memDBService.getInstance(); 
    // OBJECT UPDATE
    try {

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
            
        
    } catch (error) {
        logData.addLog('agent', {uuid}, 'error', `Error in updating map object: ${error.message}`);
    }
  
}


module.exports.yardAutoUpdate = yardAutoUpdate;
