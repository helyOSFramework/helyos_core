import * as memDBService from '../../services/in_mem_database/mem_database_service';
import { logData } from '../../modules/systemlog';

interface ObjMsg {
    body: {
        id: string;
        map_object?: any;
        map_objects?: any[];
    };
}

async function yardAutoUpdate(objMsg: ObjMsg, uuid: string): Promise<void> {
    const inMemDB = await memDBService.getInstance();
    try {
        const objUpdate = {
            id: objMsg.body.id,
            ...objMsg,
        };
        objUpdate['last_message_time'] = new Date();

        if (objMsg.body && objMsg.body.map_object) {
            await inMemDB.update('map_objects', 'id', objMsg.body.map_object, new Date());
        }

        if (objMsg.body && objMsg.body.map_objects) {
            objMsg.body.map_objects.forEach(map_object => {
                inMemDB.update('map_objects', 'id', map_object, new Date());
            });
        }

    } catch (error:any) {
        logData.addLog('agent', {
            uuid,
        }, 'error', `Error in updating map object: ${error.message}`);
    }
}

export {
    yardAutoUpdate,
};