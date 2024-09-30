// This module is used to periodically push from cache to postgres database.
//
const databaseServices = require('../services/database/database_services.js');
const memDBServices = require('../services/in_mem_database/mem_database_service.js');


const moveMemDataToDB = async () => {
    const inMemDB = await memDBServices.getInstance();
    inMemDB.flush('agents', 'uuid', databaseServices.agents, -1).catch(error => console.log("push cache to db", error));
    inMemDB.flush('map_objects', 'id', databaseServices.map_objects, -1).catch(error => console.log("push cache to db", error));
};


function initWatcher (DB_BUFFER_TIME) {

            const watcher = setInterval(() => { 
                        moveMemDataToDB();
                        }, DB_BUFFER_TIME);

}
module.exports.initWatcher = initWatcher; 