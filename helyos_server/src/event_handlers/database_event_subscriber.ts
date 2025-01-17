// ----------------------------------------------------------------------------
// Postgress notification pipeline setup :  Postgres -> Nodejs -> (Front-end socket or Message Broker or Ext. Service)
// ----------------------------------------------------------------------------

// Any mission is started by the insertion of a work process (see "work_processes_insertion" notification).
// This triggers the building of a pipeline of microservices; the pipeline is just an ordered list of service requests
// (see service_requests table in the Postgres schema).
// Each service request is dispatched as soon its status changes to "ready_for_service" (see "ready_for_service" notification).
// The controlling of each service status is performed by the external_service_watchers.js procedures.
// The microservices produces one or more assignments.
import * as webSocketCommunicaton from '../modules/communication/web_socket_communication';
import { logData } from '../modules/systemlog';
import { processInstantActionEvents } from './database_event_handlers/instant_actions_db_events_handler';
import { processWorkProcessEvents } from './database_event_handlers/workprocess_db_events_handler';
import { processAssignmentEvents } from './database_event_handlers/assignment_db_events_handler';
import { processMicroserviceEvents } from './database_event_handlers/microservice_db_events_handler';
import { createAgentRbmqAccount, removeAgentRbmqAccount } from './rabbitmq_event_handlers/checkin_event_handler';
import { processRunListEvents } from './database_event_handlers/missionqueue_db_events_handler';
import * as inMemServices from '../services/in_mem_database/mem_database_service';
import RabbitMQServices from '../services/message_broker/rabbitMQ_services';

interface DatabaseClient {
    on: (event: string, listener: (msg: any) => void) => void;
    query: (query: string) => Promise<{ rows: Array<{ [key: string]: any }> }>;
}

interface WebSocket {
    // Define any methods or properties you use from the WebSocket instance
}

async function broadcastPriorityNotifications(channel: string, payload: any, bufferNotifications: any): Promise<void> {
    switch (channel) {
        case 'change_agent_status':
            bufferNotifications.publishToFrontEnd(channel, payload, `${payload['yard_id']}`);
            logData.addLog('agent', payload, 'info', `agent changed: "${payload.connection_status}"-"${payload.status}"`);
            break;
        case 'assignments_status_update':
        case 'mission_queue_update':
        case 'work_processes_update':
            bufferNotifications.publishToFrontEnd(channel, payload, `${payload['yard_id']}`);
            break;
    }
}

async function broadcastNotifications(channel: string, payload: any, bufferNotifications: any): Promise<void> {
    const channelsWithYardId = [
        'agent_deletion',
        'assignments_insertion',
        'mission_queue_insertion',
        'service_requests_update',
        'service_requests_insertion',
        'work_processes_insertion',
    ];

    if (channelsWithYardId.includes(channel)) {
        const room = payload['yard_id'] ? `${payload['yard_id']}` : 'all';
        if (!payload['yard_id']) {
            console.warn(channel, "does not have yard id");
        }
        bufferNotifications.pushNotificationToBuffer(channel, payload, room);
    }
}

export async function handleDatabaseMessages(client: DatabaseClient, websocket: WebSocket): Promise<void> {
    const bufferNotifications = await webSocketCommunicaton.getInstance();

    client.on('notification', async (msg) => {
        let channel = msg.channel;
        let payload: any = null;

        const res = await client.query(`
            DELETE FROM events_queue
            WHERE ctid = (
              SELECT ctid
              FROM events_queue
              LIMIT 1
              FOR UPDATE SKIP LOCKED
            )
            RETURNING *;
        `);

        if (res.rows.length === 1) {
            payload = JSON.parse(res.rows[0].payload);
            channel = res.rows[0].event_name;
            broadcastPriorityNotifications(channel, payload, bufferNotifications);
            broadcastNotifications(channel, payload, bufferNotifications);
        } else {
            if (res.rows.length > 1) {
                logData.addLog('helyos_core', null, 'error', `Event query returned ${res.rows.length} events`);
            }
            return;
        }

        let inMemDB;

        switch (channel) {
            case 'new_agent_poses':
                break;

            case 'change_agent_security':
                inMemDB = await inMemServices.getInstance();
                inMemDB.update('agents', 'uuid', payload, new Date(), 'buffered');
                console.log('change_agent_security', payload['uuid']);
                break;

            case 'change_rabbitmq_permissions':
                const permissions = {
                    configure: payload['configure_permissions'],
                    write: payload['write_permissions'],
                    read: payload['read_permissions'],
                };
                await RabbitMQServices.setRBMQUserAtVhost(payload['rbmq_username'], permissions);
                break;

            case 'agent_deletion':
                inMemDB = await inMemServices.getInstance();
                inMemDB.delete('agents', 'uuid', payload['uuid']);
                logData.addLog('agent', payload, 'info', `agent deleted`);
                try {
                    await removeAgentRbmqAccount(payload);
                    inMemDB.delete('agents', 'uuid', payload['uuid']);
                } catch (error: any) {
                    logData.addLog('agent', payload, 'warn', `Remove RabbitMQ account: ${error.message}`);
                }
                break;

            case 'new_rabbitmq_account':
                try {
                    await createAgentRbmqAccount({
                        id: payload.agent_id,
                    }, payload['username'], payload['password']);
                    logData.addLog('agent', {
                        id: payload.agent_id,
                    }, 'info', `create/update rabbitmq account`);
                } catch (error: any) {
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