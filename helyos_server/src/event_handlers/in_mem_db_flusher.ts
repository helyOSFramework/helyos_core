import * as DatabaseService from '../services/database/database_services';
import * as memDBServices from '../services/in_mem_database/mem_database_service';
import RoleManager from '../role_manager';

const moveMemDataToDB = async (): Promise<void> => {
    try {
        const databaseServices = await DatabaseService.getInstance();
        const roleManager = await RoleManager.getInstance();
        if (!roleManager.amILeader) {
            return;
        }
        const inMemDB = await memDBServices.getInstance();
        const p1 = inMemDB.flush('agents', 'uuid', databaseServices.agents, -1)
            .catch(error => console.log("push in-mem data to database", error));
        const p2 = inMemDB.flush('map_objects', 'id', databaseServices.map_objects, -1)
            .catch(error => console.log("push in-mem data to database", error));
        await Promise.all([p1, p2]);
    } catch (error) {
        console.error('Error occurred during inMemDB Flushing:', error);
    }
};

function initWatcher(DB_BUFFER_TIME: number): void {
    setInterval(() => {
        moveMemDataToDB();
    }, DB_BUFFER_TIME);
}

export default { initWatcher };