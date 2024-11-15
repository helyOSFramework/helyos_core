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
const inMemServices = require('../services/in_mem_database/mem_database_service.js');



function broadcastPriorityNotification(channel, payload, bufferNotifications){

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

function broadcastNotifications(channel, payload, bufferNotifications) {

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
function handleDatabaseMessages(client, websocket, bufferNotifications) {

    client.on('notification', async function (msg) {
        let channel = msg.channel;
        let payload = null

        const res = await client.query("DELETE FROM events_queue USING ( SELECT * FROM events_queue LIMIT 1 FOR UPDATE SKIP LOCKED) q WHERE q.id = events_queue.id RETURNING events_queue.*;");
        if (res.rows.length){
            const bufferNotifications =  await webSocketCommunicaton.getInstance();
            payload = JSON.parse(res.rows[0].payload)
            channel = res.rows[0].event_name;
            broadcastPriorityNotification(channel, payload, bufferNotifications);
            broadcastNotifications(channel, payload, bufferNotifications);

        } else {
            return false;
        }

        let inMemDB;

        switch (channel) {
        // AGENT TABLES TRIGGERS

            case 'new_agent_poses':
                // bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                // Positions are being already pushed from rabbitMQ client to WebSockets.
                break;

            case 'change_agent_security':
                inMemDB = await inMemServices.getInstance();
                console.log('change_agent_security', payload['uuid']);
                inMemDB.update('agents', 'uuid', payload, new Date(), 'buffered');
                break;

            case 'agent_deletion':
                inMemDB = await inMemServices.getInstance();
                inMemDB.delete('agents','uuid', payload['uuid']);
                logData.addLog('agent', payload, 'info', `agent deleted`);

                try {
                    await removeAgentRbmqAccount(payload);
                    inMemDB.delete('agents','uuid', payload['uuid']);
                } catch (error) {
                    logData.addLog('agent', payload, 'warn', `Remove RabbitMQ account: ${error.message}`);
                }

                break;

            case 'change_agent_status':
                logData.addLog('agent', payload, 'info', `agent changed: "${payload.connection_status}"-"${payload.status}"`);
                break;


            case 'new_rabbitmq_account':
                try {
                    await createAgentRbmqAccount({id: payload.agent_id}, payload['username'], payload['password']);
                logData.addLog('agent', {id: payload.agent_id}, 'info', `create/update rabbitmq account`);
                } catch (error) {
                    logData.addLog('agent', payload, 'error', `Create RabbitMQ account: ${error.message}`);
                }

                break;

            default:

                if (channel.includes('service_request')) {
                    processMicroserviceEvents(channel, payload);
                    break;
                }


                if (channel.includes('work_process')) {
                    processWorkProcessEvents(channel, payload);
                    break;
                }

                if (channel.includes('assignments')) {
                    processAssignmentEvents(channel, payload);
                    break;
                }

                if (channel.includes('instant_action')) {
                    processInstantActionEvents(channel, payload);
                    break;
                }

                if (channel.includes('mission_queue')) {
                    processRunListEvents(channel, payload);
                    break;
                }


                break;
        }

    });
}


module.exports.handleDatabaseMessages = handleDatabaseMessages;