// ----------------------------------------------------------------------------
// Postgress notification pipeline setup :  Postgres -> Nodejs -> (Front-end socket or Message Broker or Ext. Service)
// ----------------------------------------------------------------------------

// Any mission is started by the insertion of a work process (see "work_processes_insertion" notification).
// This triggers the building of a pipeline of microservices; the pipeline is just a sorted list of service requests 
// (see service_requests table).
// Each service request is dispatched as soon its status changes to "ready_for_service" (see "ready_for_service" notification).
// The controlling of the microservice status is performed by the external_service_watchers.js procedures.
// The microservices produces one or more assignments.


const webSocketCommunicaton = require('../modules/communication/web_socket_communication.js');
const { logData } = require('../modules/systemlog');
const { processInstantActionEvents } = require('./database_event_handlers/instant_actions_db_events_handler.js');
const {processWorkProcessEvents} = require('./database_event_handlers/workprocess_db_events_handler.js');
const {processAssignmentEvents} = require('./database_event_handlers/assignment_db_events_handler.js');
const {processMicroserviceEvents} = require('./database_event_handlers/microservice_db_events_handler.js');
const {createAgentRbmqAccount, removeAgentRbmqAccount} = require('./rabbitmq_event_handlers/checkin_event_handler.js');
const {processRunListEvents} = require('./database_event_handlers/missionqueue_db_events_handler.js');
const bufferNotifications = webSocketCommunicaton.bufferNotifications;


function broadcastNotifications(msg) {
    let payload = JSON.parse(msg.payload);

    switch (msg.channel) {

            case 'agent_deletion': // Changes originate from applications (e.g. dashboard).
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                break;

            case 'change_agent_status': // Changes originate from agents.
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                break;

            case 'assignments_status_update':
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                break;

            case 'assignments_insertion':
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                break;

            case  'mission_queue_insertion':
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                break;

            case 'mission_queue_update':
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                break;

            case 'service_requests_update':
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                break;

            case 'service_requests_insertion':
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                break;

            case 'work_processes_insertion':
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                break;

            case 'work_processes_update':
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                break;
    }
}




// Subscribe to database changes
function handleDatabaseMessages(client, inMemDB) {

    client.on('notification', async function (msg) {
        let payload = null
        let msgchannel0 = msg.channel;
        let id = 0;

        broadcastNotifications(msg);
    
        const res = await client.query("DELETE FROM events_queue USING ( SELECT * FROM events_queue LIMIT 1 FOR UPDATE SKIP LOCKED) q WHERE q.id = events_queue.id RETURNING events_queue.*;");
        if (res.rows.length){
            payload = JSON.parse(res.rows[0].payload)
            msg.channel = res.rows[0].event_name;
            id =  res.rows[0].id;
        }else {
            return false;
        }


        switch (msg.channel) {
        // AGENT TABLES TRIGGERS

            case 'change_agent_security': // Changes originate from agents or from applications (e.g. dashboard).
                console.log('change_agent_security', payload);
                inMemDB.update('agents', 'uuid', payload, new Date(), 'realtime');
                break;

            case 'agent_deletion': // Changes originate from applications (e.g. dashboard).
                inMemDB.delete('agents','uuid', payload['uuid']);
                removeAgentRbmqAccount(payload);
                logData.addLog('agent', payload, 'normal', `agent deleted`);
                break;

            case 'change_agent_status': // Changes originate from agents.
                logData.addLog('agent', payload, 'normal', `agent changed: "${payload.connection_status}"-"${payload.status}"`);
                break;


            case 'new_rabbitmq_account':
                logData.addLog('agent', {id: payload.agent_id}, 'normal', `create/update rabbitmq account`);
                createAgentRbmqAccount({id: payload.agent_id}, payload['username'], payload['password']);
                break;

            default:

                if (msg.channel.includes('service_request')) {
                    processMicroserviceEvents(msg);
                    break;
                }


                if (msg.channel.includes('work_process')) {
                    processWorkProcessEvents(msg);
                    break;
                }

                if (msg.channel.includes('assignments')) {
                    processAssignmentEvents(msg);
                    break;
                }

                if (msg.channel.includes('instant_action')) {
                    processInstantActionEvents(msg);
                    break;
                }

                if (msg.channel.includes('mission_queue')) {
                    processRunListEvents(msg);
                    break;
                }


                break;
        }

    });
}


module.exports.handleDatabaseMessages = handleDatabaseMessages;