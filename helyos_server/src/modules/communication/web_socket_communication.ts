import { WebSocketService } from '../../services/socket_services';
import * as utils from '../../modules/utils';
import * as memDBService from '../../services/in_mem_database/mem_database_service';
import { logData } from '../systemlog';
import  RoleManager  from '../../role_manager';

const PERIOD: number = 100;

interface Agent {
    id: string;
    uuid: string;
    x: number;
    y: number;
    z: number;
    orientations: any;
    sensors: any;
    last_message_time: Date;
    yard_id: string;
    msg_per_sec?: number;
}

interface MapObject {
    yard_id: string;
    last_message_time: Date;
    [key: string]: any;
}

interface BufferPayload {
    [room: string]: { // socket room is the yard ID or 'all'
        [channel: string]: any[] | null;
    };
}

// Buffer Notifications to avoid flooding front-end with messages
class BufferNotifications {
    private bufferRetainTime: number;
    private bufferPayload: BufferPayload;
    private eventDispatchBuffer: NodeJS.Timer | null;
    private webSocketService: WebSocketService;
    private static instance: BufferNotifications | null = null;

    constructor(bufferRetainTime: number, webSocketService: WebSocketService) {
        if (BufferNotifications.instance) {
            return BufferNotifications.instance;
        }
        this.webSocketService = webSocketService;
        this.bufferRetainTime = bufferRetainTime;
        this.bufferPayload = {};
        this.eventDispatchBuffer = setInterval(async () => {
            const roleManager = await RoleManager.getInstance();
            if (roleManager.role !== 'broadcaster') {
                return;
            }
            const inMemDB = await memDBService.getInstance();
            await this._get_latest_updated_data(inMemDB);
            return this._dispatch();
        }, bufferRetainTime);
        BufferNotifications.instance = this;
    }

    private _dispatch(): void {
        this.webSocketService.dispatchAllBufferedMessages(this.bufferPayload);
    }

    private async _get_latest_updated_data(inMemDB: memDBService.InMemDB): Promise<void> {
        if (!inMemDB) {
            return;
        }

        const inMemAgents: { [key: string]: Agent } = await inMemDB.list('agents');
        const inMemBufferedAgents: { [key: string]: Agent } = await inMemDB.list('agents_buffer');
        const inMemMapObjects: { [key: string]: MapObject } = await inMemDB.list('map_objects');
        const inMemBufferedMapObject: { [key: string]: MapObject } = await inMemDB.list('map_objects_buffer');

        for (const key in inMemAgents) {
            if (inMemAgents[key].id == null) {
                logData.addLog('agent', {
                    uuid: key,
                }, 'error', `MemDB error, id not registered`);
                console.log(key, 'MemDB error, id not registered');
                continue;
            }

            let agent = inMemBufferedAgents[key];
            if (!agent) {
                const {
                    id, uuid, x, y, z, orientations, sensors, last_message_time, yard_id,
                } = inMemAgents[key];
                agent = {
                    id,
                    uuid,
                    x,
                    y,
                    z,
                    orientations,
                    sensors,
                    last_message_time,
                    yard_id,
                };
            }
            if (!agent.yard_id) {
                agent.yard_id = inMemAgents[key].yard_id;
            }

            agent.msg_per_sec = inMemAgents[key].msg_per_sec;
            const webSocketNotification = {
                agent_id: inMemAgents[key].id,
                tool_id: inMemAgents[key].id,
                ...agent,
            };
            this.pushNotificationToBuffer('new_agent_poses', webSocketNotification, `${agent.yard_id}`);
        }

        const now = new Date();
        for (const key in inMemMapObjects) {
            if (now.getTime() - inMemMapObjects[key].last_message_time.getTime() < 2 * this.bufferRetainTime) {
                let mapObject = inMemBufferedMapObject[key];
                if (!mapObject) {
                    mapObject = inMemMapObjects[key];
                }
                if (!mapObject.yard_id) {
                    mapObject.yard_id = inMemMapObjects[key].yard_id;
                }
                const webSocketNotification = mapObject;
                this.pushNotificationToBuffer('map_objects_updates', webSocketNotification, `${mapObject.yard_id}`);
            }
        }
    }

    public pushNotificationToBuffer(channel: string, payload: any, room: string = 'all'): void {
        const _payload = utils.camelizeAttributes(payload);
        if (!this.bufferPayload) {
            this.bufferPayload = {};
        }
        if (!this.bufferPayload[room]) {
            this.bufferPayload[room] = {};
            this.bufferPayload[room][channel] = null;
        }

        if (this.bufferPayload[room][channel]) {
            this.bufferPayload[room][channel]!.push(_payload);
        } else {
            this.bufferPayload[room][channel] = [_payload];
        }
    }

    public publishToFrontEnd(channel: string, payload: any, room: string): void {
        this.pushNotificationToBuffer(channel, payload, room);
        return this._dispatch();
    }
}

/**
 * Retrieves the BufferNotifications singleton instance.
 *
 * @returns {Promise<BufferNotifications>} - The singleton instance.
 */
let bufferNotifications: BufferNotifications | null = null;

async function getInstance(): Promise<BufferNotifications> {
    if (!bufferNotifications) {
        console.log('====> Creating In WebSocket Notification Buffer instance');
        try {
            const webSocketService = await WebSocketService.getInstance();
            bufferNotifications = new BufferNotifications(PERIOD, webSocketService);
        } catch (error) {
            console.error('Failed to initialize BufferNotifications:', error);
            throw error;
        }
    }
    return bufferNotifications;
}

export {
    BufferNotifications, getInstance,
};