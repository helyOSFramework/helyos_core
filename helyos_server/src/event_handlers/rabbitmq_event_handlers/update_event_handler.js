
const InMemorySensorTable = {};
const databaseServices = require('../../services/database/database_services');
const {inMemDB} = require('../../services/in_mem_database/mem_database_service');
const webSocketCommunicaton = require('../../modules/communication/web_socket_communication');
const { saveLogData } = require('../../modules/systemlog.js');
const bufferNotifications = webSocketCommunicaton.bufferNotifications;



async function agentAutoUpdate(objMsg, uuid, bufferPeriod=0) {
    // COMMENT: rabbitmq username must be the agent uuid.
    // check against the agent.rbmq_username for each received message is too expensive, unless we implement a in-memory table.
    // 02/06/2023: update, we need to poll data from the database anyway because the MQTT agents, we will need a in-memory database.

    // AGENT UPDATE
    let agentUpdate = {uuid};
    agentUpdate['last_message_time'] = new Date();

    // Get the agent id only once and save in in-memory table.
    if (!inMemDB.agents[uuid] || !inMemDB.agents[uuid].id ){
        const toolIds = await databaseServices.agents.getIds([uuid]);
        inMemDB.update('agents', 'uuid', {uuid, id:toolIds[0]},agentUpdate['last_message_time']);
    }


    if ('status' in objMsg) { // Backwards compatibility helyos_agent_core <= 3.1.0
        agentUpdate['status'] = objMsg['status'];
    }

    let msgBody = objMsg;  // Backwards compatibility helyos_agent_core <= 1.5.13
    if ('body' in objMsg) {
        msgBody = objMsg.body;
    }

    if (!msgBody) return;

    if ('pose' in msgBody) {
        agentUpdate['x'] = msgBody['pose']['x'];
        agentUpdate['y'] = msgBody['pose']['y'];
        agentUpdate['z'] = msgBody['pose']['z'];
        if (msgBody['pose']['orientations'] && msgBody['pose']['orientations'].length > 0) {
            agentUpdate['orientation'] = msgBody['pose']['orientations'][0];
            agentUpdate['orientations'] = msgBody['pose']['orientations'];
        }  
        InMemorySensorTable[uuid] = msgBody['pose'];
    }

    if ('name' in msgBody) {
        agentUpdate['name'] = msgBody['name'];
    }

    if ('code' in msgBody) {
        agentUpdate['code'] = msgBody['code'];
    }

    if ('data_format' in msgBody) {
        agentUpdate['data_format'] = msgBody['data_format'];
    }
    
    if ('agent_type' in msgBody) {
        agentUpdate['agent_type'] = msgBody['agent_type'];
    }

    if ('unit' in msgBody) {
        agentUpdate['unit'] = msgBody['unit'];
    }

    if ('sensors' in msgBody) {
        agentUpdate['sensors'] = msgBody['sensors'];
    }

    if ('is_actuator' in msgBody) {
        agentUpdate['is_actuator'] = msgBody['is_actuator'];
    }

    if ('wp_clearance' in msgBody) {
        agentUpdate['wp_clearance'] = objMsg['wp_clearance'];
    }

    let vehicleGeometry, factSheet;

    if ('factsheet' in msgBody){
        factSheet =  msgBody['factsheet']; // VDA 5050
    } 

    if ('geometry' in msgBody) {
        vehicleGeometry = msgBody['geometry'];
    }

    if ('followers' in msgBody) {
        connectFollowersToLeader(uuid,  msgBody['followers']);
    }

    // JSON conversion postgres bug-workaround https://github.com/brianc/node-postgres/pull/1432
    let JSONGeometry;
    if (vehicleGeometry) {
        if (Array.isArray(vehicleGeometry)) {
            agentUpdate['geometry'] =  JSON.stringify(vehicleGeometry); // Backward compatibility: 
            JSONGeometry = vehicleGeometry;

        } else {
            agentUpdate['geometry'] = vehicleGeometry; // Backward compatibility:
            JSONGeometry = JSON.parse(vehicleGeometry);
        }
    }

    if (factSheet){
        if (Array.isArray(factSheet)) {
            agentUpdate['factsheet'] =  JSON.stringify(factSheet);
        } else {
            agentUpdate['factsheet'] = factSheet;
        }
        //
    }


    if (JSONGeometry){
        const qryToolData = await databaseServices.agents.get('uuid', uuid, ['id', 'status']);
        if (qryToolData.length) {
            const toolData = qryToolData[0];
            let webSocketNotification = {'id': toolData.id, 'uuid': uuid, 'geometry': JSONGeometry, 'status': toolData.status};
            bufferNotifications.pushNotificationToFrontEnd('change_agent_status', webSocketNotification);
        }
    }

    let statsLabel = 'buffered';
    if (bufferPeriod === 0) {
        statsLabel = 'realtime';
    }
    inMemDB.update('agents','uuid', agentUpdate, agentUpdate.last_message_time, statsLabel);
    return inMemDB.flush('agents', 'uuid', databaseServices.agents, bufferPeriod);
}


async function connectFollowersToLeader (leaderUUID, followerUUIDs) {
    databaseServices.connectAgents(leaderUUID, followerUUIDs)
    .then((newConnectionIds) => {
        saveLogData('agent', {uuid: leaderUUID}, 'normal', `new connected followers # : ${newConnectionIds}` );
        // Allow follower agents to be updated by the leader agent user account.
        const followerPatchs = followerUUIDs.map( uuid => ({uuid, rbmq_username: leaderUUID}));
        return databaseServices.agents.updateMany(followerPatchs,'uuid');
    })
    .catch( e => {
        saveLogData('agent', {uuid: leaderUUID}, 'error', `lead-follower connection: ${e}` );
    })
}

module.exports.agentAutoUpdate = agentAutoUpdate;
