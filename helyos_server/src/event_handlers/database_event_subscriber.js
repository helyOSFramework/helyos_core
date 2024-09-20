// ----------------------------------------------------------------------------
// Postgress notification pipeline setup :  Postgres -> Nodejs -> (Front-end socket or Message Broker or Ext. Service)
// ----------------------------------------------------------------------------

// Any mission is started by the insertion of a work process (see "work_processes_insertion" notification).
// This triggers the building of a pipeline of microservices; the pipeline is just an ordered list of service requests 
// (see service_requests table in the Postgres schema).
// Each service request is dispatched as soon its status changes to "ready_for_service" (see "ready_for_service" notification).
// The controlling of each service status is performed by the external_service_watchers.js procedures.
// The microservices produces one or more assignments.


const webSocketCommunicaton = require('../modules/communication/web_socket_communication.js');
const { logData } = require('../modules/systemlog');
const { processInstantActionEvents } = require('./database_event_handlers/instant_actions_db_events_handler.js');
const {processWorkProcessEvents} = require('./database_event_handlers/workprocess_db_events_handler.js');
const {processAssignmentEvents} = require('./database_event_handlers/assignment_db_events_handler.js');
const {processMicroserviceEvents} = require('./database_event_handlers/microservice_db_events_handler.js');
const {createAgentRbmqAccount, removeAgentRbmqAccount} = require('./rabbitmq_event_handlers/checkin_event_handler.js');
const {processRunListEvents} = require('./database_event_handlers/missionqueue_db_events_handler.js');
const { inMemDB } = require('../services/in_mem_database/mem_database_service.js');
const bufferNotifications = webSocketCommunicaton.bufferNotifications;



function broadcastPriorityNotification(channel, payload){
    switch (channel) {

        case 'change_agent_status': // Changes originate from agents.
            bufferNotifications.publishToFrontEnd(channel, payload);
            break;

        case 'assignments_status_update':
            bufferNotifications.publishToFrontEnd(channel, payload);
            break;

        case 'mission_queue_update':
            bufferNotifications.publishToFrontEnd(channel, payload);
            break;

        case 'work_processes_update':
            bufferNotifications.publishToFrontEnd(channel, payload);
            break;
    }
}

function broadcastNotifications(channel, payload) {
    switch (channel) {

            case 'agent_deletion': // Changes originate from applications (e.g. dashboard).
                bufferNotifications.pushNotificationToBuffer(channel, payload);
                break;

            case 'assignments_insertion':
                bufferNotifications.pushNotificationToBuffer(channel, payload);
                break;

            case  'mission_queue_insertion':
                bufferNotifications.pushNotificationToBuffer(channel, payload);
                break;

            case 'service_requests_update':
                bufferNotifications.pushNotificationToBuffer(channel, payload);
                break;

            case 'service_requests_insertion':
                bufferNotifications.pushNotificationToBuffer(channel, payload);
                break;

            case 'work_processes_insertion':
                bufferNotifications.pushNotificationToBuffer(channel, payload);
                break;

    }
}




// Subscribe to database changes
function handleDatabaseMessages(client) {
    client.on('notification', function (msg) {
        let payload = JSON.parse(msg.payload);

        broadcastPriorityNotification(msg.channel, JSON.parse(msg.payload));
        broadcastNotifications(msg.channel, JSON.parse(msg.payload));

        switch (msg.channel) {
        // AGENT TABLES TRIGGERS

            case 'new_agent_poses':
                // bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                // Positions are being already pushed from rabbitMQ client to WebSockets.
                break;

            case 'change_agent_security':
                console.log('change_agent_security', payload);
                inMemDB.update('agents', 'uuid', payload, new Date(), 'realtime');
                break;

            case 'agent_deletion':
                inMemDB.delete('agents','uuid', payload['uuid']);
                removeAgentRbmqAccount(payload);
                logData.addLog('agent', payload, 'normal', `agent deleted`);
                break;

            case 'change_agent_status':
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