import databaseService from '../../services/database/database_services';
import * as memDBService from '../../services/in_mem_database/mem_database_service';
import rabbitMQServices from '../../services/message_broker/rabbitMQ_services';

interface ObjMsg {
    body: {
        query?: string;
        mutation?: string;
        conditions?: Record<string, any>;
        data?: any[];
    };
}

interface MsgProps {
    replyTo?: string;
    correlationId?: string;
}

async function queryDataBase(uuid: string, objMsg: ObjMsg, msgProps: MsgProps): Promise<number> {
    const inMemDB = await memDBService.getInstance();

    if (inMemDB.agents_stats[uuid]) {
        inMemDB.countMessages('agents_stats', uuid, 'updtPerSecond');
    }

    const replyTo = msgProps.replyTo ? msgProps.replyTo : uuid;
    let response; let message;
    try {
        switch (objMsg.body['query']) {
            case 'allAgents':
                response = await databaseService.agents.select(objMsg.body['conditions']);
                break;

            case 'allLeaders':
                if (objMsg.body['conditions'] && objMsg.body['conditions']['uuid']) {
                    response = await databaseService.agents.get('uuid', objMsg.body['conditions']['uuid'], ['id','uuid', 'geometry'], null, false, ['leader_connections']);
                    response = response[0]['leader_connections'];
                } else {
                    throw Error('Please include the follower uuid in the data request conditions. For example: {"uuid" : "1111-2222-3333-4444" }');
                }
                break;

            case 'allFollowers':
                if (objMsg.body['conditions'] && objMsg.body['conditions']['uuid']) {
                    response = await databaseService.agents.get('uuid', objMsg.body['conditions']['uuid'], ['id','uuid', 'geometry'], null, false, ['follower_connections']);
                    response = response[0]['follower_connections'];
                } else {
                    throw Error('Please include the leader uuid in the data request conditions. For example: {"uuid" : "1111-2222-3333-4444" }');
                }
                break;

            case 'allYards':
                response = await databaseService.yards.select(objMsg.body['conditions'] || {});
                break;

            case 'allExecutingMissions':
                response = await databaseService.work_processes.select({
                    status: 'executing',
                });
                break;

            case 'allAssignmentsByMissionId':
                if (objMsg.body['conditions']){
                    const ms_id = objMsg.body.conditions.work_process_id || objMsg.body.conditions.mission_id;
                    response = await databaseService.assignments.select({
                        work_process_id: ms_id,
                    });
                } else {
                    throw Error('Please include work_process_id (mission_id) in conditions. For example: {"work_process_id" : 1 }');
                }
                break;

            case 'allAssignmentsByWorkProcessId':
                if (objMsg.body['conditions']){
                    const wp_id = objMsg.body.conditions.work_process_id || objMsg.body.conditions.mission_id;
                    response = await databaseService.assignments.select({
                        work_process_id: wp_id,
                    });
                } else {
                    throw Error('Please include work_process_id (mission_id) in "conditions|. For example: {"work_process_id" : 1 }');
                }
                break;

            case 'allMapObjects':
                let conditions = objMsg.body['conditions'] || {
                    deleted_at: null,
                };
                conditions = {
                    deleted_at: null,
                    ...conditions,
                };
                response = await databaseService.map_objects.select(conditions);
                break;
            default:
                break;
        }

        switch (objMsg.body['mutation']) {

            case 'createMapObjects':
                response = await databaseService.map_objects.insertMany(objMsg.body['data'])
                    .then(async (newIds) => {
                        const newObjects = await databaseService.map_objects.list_in('id',newIds);
                        newObjects.forEach(obj => {
                            inMemDB.update('map_objects', 'id', obj, new Date());
                        });
                        return newIds;
                    });
                break;

            case 'updateMapObjects':
                const patches = objMsg.body['data']? objMsg.body['data']:[];
                await Promise.all(patches.map(async patch => {
                    inMemDB.update('map_objects', 'id', patch, new Date());
                    await databaseService.map_objects.update_byId(patch['id'], patch);
                }));
                response = "successful";
                break;

            case 'deleteMapObjects':
                response = await databaseService.map_objects.delete(objMsg.body['condition'])
                    .then((r) => {
                        console.log(r);
                    });
                break;

            case 'deleteMapObjectByIds':
                response = await databaseService.map_objects.deleteByIds(objMsg.body['condition']['ids'])
                    .then((r) => {
                        objMsg.body['condition']['ids'].forEach(id => {
                            inMemDB.delete('map_objects', 'id', id);
                        });
                    });
                break;

            default:
                break;
        }

        message = JSON.stringify(response);

    } catch (error) {
        response = {
            "error": JSON.stringify(error, Object.getOwnPropertyNames(error)),
        };
        message = JSON.stringify(response);
    }

    rabbitMQServices.sendEncryptedMsg(replyTo, message, '', '', '', msgProps.correlationId);
    return 0;
}

export  {
    queryDataBase,
};