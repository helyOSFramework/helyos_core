// ----------------------------------------------------------------------------
// Postgres notification pipeline setup: Postgres -> Node.js -> (Front-end socket, Message Broker, or External Service)
// ----------------------------------------------------------------------------

import databaseServices from '../../services/database/database_services';
import agentComm from '../../modules/communication/agent_communication';
import { logData } from '../../modules/systemlog';

// Type definitions for the payload
interface InstantActionPayload {
    agent_id?: number;
    agent_uuid?: string;
    command?: string;
    sender?: string;
}

/**
 * Handles database change events for instant actions.
 * @param channel The channel name from the database notification.
 * @param payload The payload containing event data.
 */
export async function processInstantActionEvents(channel: string, payload: InstantActionPayload): Promise<void> {
    switch (channel) {
        case 'instant_actions_insertion': {
            let { agent_id: agentId, agent_uuid: agentUuid } = payload;

            if (agentId && !agentUuid) {
                const uuids = await databaseServices.agents.getUuids([agentId]);
                agentUuid = uuids[0];
            }

            if (!agentId && agentUuid) {
                const agentIds = await databaseServices.agents.getIds([agentUuid]);
                agentId = agentIds[0];
            }

            if (agentId) {
                await agentComm.sendCustomInstantActionToAgent(agentId, payload.command || '');
            }

            const log = { agent_id: agentId, agent_uuid: agentUuid, sender: payload.sender };
            logData.addLog('agent', log, 'info', `Send custom instant action to agent`);

            break;
        }

        default:
            // Handle other channels or ignore unknown events
            break;
    }
}
