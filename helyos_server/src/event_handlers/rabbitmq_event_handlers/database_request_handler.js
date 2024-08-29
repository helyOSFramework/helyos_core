
const databaseServices = require('../../services/database/database_services.js');
const {inMemDB } = require('../../services/in_mem_database/mem_database_service.js');
const rabbitMQServices = require('../../services/message_broker/rabbitMQ_services.js');


async function queryDataBase(uuid, objMsg, msgProps) {
    console.log(objMsg, msgProps);
    inMemDB.agents_stats[uuid]['updtPerSecond'].countMessage();
    
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
                response = await databaseServices.mapObjects.select(objMsg.body['conditions'] || {});
                break;             
        }

        switch (objMsg.body['mutation']) {

            case 'createMapObjects':       
                response = await databaseServices.mapObjects.insertMany(objMsg.body['data'])
                .then( async (newIds) => {
                    console.log(r);
                    const newObjects = await databaseServices.mapObjects.list_in(newIds);
                    newObjects.forEach( obj => { inMemDB.update('map_objects', 'id', obj, new Date(), 'realtime'); });
                });
                break;    

            case 'deleteMapObjects':       
                response = await databaseServices.mapObjects.delete(objMsg.body['condition'])
                .then( (r) => {
                    console.log(r);
                });
                break;    

            case 'deleteMapObjectByIds':       
                response = await databaseServices.mapObjects.deleteByIds(objMsg.body['condition']['ids'])
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

    rabbitMQServices.sendEncriptedMsg(replyTo, message, null, null, null, msgProps.correlationId);
    return 0;
}

module.exports.queryDataBase = queryDataBase;
