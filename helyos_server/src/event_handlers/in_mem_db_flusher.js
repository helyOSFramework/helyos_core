// This module is used to periodically push from cache to postgres database.
//
const databaseServices = require('../services/database/database_services.js');
const memDBServices = require('../services/in_mem_database/mem_database_service.js');
const roleManagerModule = require('../role_manager.js');


const moveMemDataToDB = async () => {
    try {
        const roleManager = await roleManagerModule.getInstance();
        if (!roleManager.amILeader) { return;}
        const inMemDB = await memDBServices.getInstance();
        const p1 = inMemDB.flush('agents', 'uuid', databaseServices.agents, -1).catch(error => console.log("push in-mem data to database", error));
        const p2 = inMemDB.flush('map_objects', 'id', databaseServices.map_objects, -1).catch(error => console.log("push in-mem data to database", error));
        await Promise.all([p1,p2]);
    } catch (error) {
        console.error('Error occurred during inMemDB Flushing:', error);
    }
};


function initWatcher (DB_BUFFER_TIME) {

            const watcher = setInterval(() => { 
                        moveMemDataToDB();
                        }, DB_BUFFER_TIME);

}
module.exports.initWatcher = initWatcher; 