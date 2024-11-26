
const databaseServices = require('../../services/database/database_services.js');
const memDBService = require('../../services/in_mem_database/mem_database_service.js');
const rabbitMQServices = require('../../services/message_broker/rabbitMQ_services.js');


async function queryDataBase(uuid, objMsg, msgProps) {
    const inMemDB = await memDBService.getInstance();

    // If in-memory datatabase is set, track the number of postgres hits.
    if (inMemDB.agents_stats[uuid]) {
        inMemDB.countMessages('agents_stats', uuid, 'updtPerSecond');
    }
    
    let replyTo = msgProps.replyTo?  msgProps.replyTo : uuid;
    let response, message;
    try {
        switch (objMsg.body['query']) {
            case 'allAgents':
                response = await databaseServices.agents.select(objMsg.body['conditions']);
                break;

            case 'allLeaders':
                if (objMsg.body['conditions'] && objMsg.body['conditions']['uuid']) {
                    response = await databaseServices.agents.get('uuid', objMsg.body['conditions']['uuid'], ['id','uuid', 'geometry'], null, ['leader_connections']);
                    response = response[0]['leader_connections'];
                } else {
                    throw Error('Please include the follower uuid in the data request conditions. For example: {"uuid" : "1111-2222-3333-4444" }');
                }
                break;


            case 'allFollowers':
                if (objMsg.body['conditions'] && objMsg.body['conditions']['uuid']) {
                    response = await databaseServices.agents.get('uuid', objMsg.body['conditions']['uuid'], ['id','uuid', 'geometry'], null, ['follower_connections']);
                    response = response[0]['follower_connections'];
                } else {
                    throw Error('Please include the leader uuid in the data request conditions. For example: {"uuid" : "1111-2222-3333-4444" }');
                }
                break;

            case 'allYards':
                response = await databaseServices.yards.select(objMsg.body['conditions'] || {});
                break;

            case 'allExecutingMissions':
                response = await databaseServices.work_processes.select({status: 'executing'});
                break;            
            
            case 'allAssignmentsByMissionId':
                const wp_id = objMsg.body['conditions']['work_process_id'] || objMsg.body['conditions']['mission_id']
                if (objMsg.body['conditions'] && wp_id){
                    response = await databaseServices.assignments.select({work_process_id: wp_id});
                } else {
                    throw Error('Please include work_process_id (mission_id) in conditions. For example: {"work_process_id" : 1 }');
                }
                break;

            case 'allMapObjects':
                let conditions = objMsg.body['conditions'] || {deleted_at: null};
                conditions = {deleted_at: null, ...conditions};
                response = await databaseServices.map_objects.select(conditions);
                break;             
        }

        switch (objMsg.body['mutation']) {

            case 'createMapObjects':       
                response = await databaseServices.map_objects.insertMany(objMsg.body['data'])
                .then( async (newIds) => {
                    const newObjects = await databaseServices.map_objects.list_in(newIds);
                    newObjects.forEach( obj => { inMemDB.update('map_objects', 'id', obj, new Date()); });
                    return newIds;
                });
                break;    

                
            case 'updateMapObjects': 
                const patches = objMsg.body['data'];    
                patches.forEach( patch => {
                    inMemDB.update('map_objects', 'id', patch, new Date());
                });
                response = "data saved";
                break;    


            case 'deleteMapObjects':       
                response = await databaseServices.map_objects.delete(objMsg.body['condition'])
                .then( (r) => {
                    console.log(r);
                });
                break;    

            case 'deleteMapObjectByIds':       
                response = await databaseServices.map_objects.deleteByIds(objMsg.body['condition']['ids'])
                .then( (r) => {
                    objMsg.body['condition']['ids'].forEach( id => { inMemDB.delete('map_objects', 'id', id); });
                });
                break;   

            default:
                break;
        }

    message = JSON.stringify(response);
    
    } catch (error) {
        response = {"error": JSON.stringify(error, Object.getOwnPropertyNames(error))};    
        message = JSON.stringify(response);
    }

    rabbitMQServices.sendEncryptedMsg(replyTo, message, null, null, null, msgProps.correlationId);
    return 0;
}

module.exports.queryDataBase = queryDataBase;
