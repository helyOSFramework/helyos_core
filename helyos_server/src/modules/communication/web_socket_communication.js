

const socketService = require('../../services/socket_services.js');
const utils = require('../../modules/utils.js');
const memDBServices = require('../../services/in_mem_database/mem_database_service');
const { logData } = require('../systemlog.js');
const PERIOD = 100;
const roleManagerModule = require('../../role_manager.js');

// Buffer Notifications to avoid flooding front-end with messages
class BufferNotifications {
    bufferRetainTime = 500;
    bufferPayload = {}; 
    eventDispatchBuffer = null;
    static instance = null;


    constructor(bufferRetainTime, webSocketService) {
        if (BufferNotifications.instance) {
            return BufferNotifications.instance;
        }
        console.log('instantiating new BufferNotifications');
        this.webSocketService = webSocketService;
		this.bufferRetainTime = bufferRetainTime;
        this.bufferPayload = {};
        this.eventDispatchBuffer = setInterval(async () => {
                                        const roleManager = await roleManagerModule.getInstance();
                                        if(roleManager.role != 'broadcaster') return;
                                        const inMemDB = await memDBServices.getInstance()
                                        await this._get_latest_updated_data(inMemDB)
                                        return this._dispatch();          
                                     },
                                    bufferRetainTime);
        BufferNotifications.instance = this;
    }


    _dispatch() {
        this.webSocketService.dispatchAllBufferedMessages(this.bufferPayload);
    }


    async _get_latest_updated_data(inMemDB) {
        if(!inMemDB) return;
        const inMemAgents = await inMemDB.list('agents');
        const inMemBufferedAgents = await inMemDB.list('agents_buffer');
        const inMemMapObjects = await inMemDB.list('map_objects');
        const inMemBufferedMapObject = await inMemDB.list('map_objects_buffer');

        for (const key in inMemAgents) { 
            if(inMemAgents[key].id == null) {
                logData.addLog('agent', {uuid:key}, 'error', `MemDB error, id not registered`);
                console.log( key, 'MemDB error, id not registered');
                continue; 
            }

            let agent = inMemBufferedAgents[key];
            if(!agent) {
                const {id, uuid, x, y, z, orientations, sensors, last_message_time, yard_id} = inMemAgents[key];
                agent = {id, uuid, x, y, z, orientations, sensors, last_message_time,  yard_id};                 
            } 
            if(!agent.yard_id) {
                agent.yard_id = inMemAgents[key].yard_id;
            }

            agent['msg_per_sec'] = inMemAgents[key]['msg_per_sec'];
            const webSocketNotification = {'agent_id':inMemAgents[key].id,'tool_id':inMemAgents[key].id, ...agent };
            this.pushNotificationToBuffer('new_agent_poses', webSocketNotification, `${agent['yard_id']}`);
        }

        const now = new Date();
        for (const key in inMemMapObjects) { 

            if(now - inMemMapObjects[key]['last_message_time'] < 2*this.bufferRetainTime) {
                let mapObject = inMemBufferedMapObject[key];
                if(!mapObject) {
                    mapObject =  inMemMapObjects[key];                
                } 
                if(!mapObject.yard_id) {
                    mapObject.yard_id = inMemMapObjects[key].yard_id;
                }
                const webSocketNotification =  mapObject;
                this.pushNotificationToBuffer('map_objects_updates', webSocketNotification, `${mapObject['yard_id']}`);
            }
        }

    }

    pushNotificationToBuffer(channel, payload, room='all') {
        let _payload = utils.camelizeAttributes(payload);
        if (!this.bufferPayload) {
            this.bufferPayload = {};
        }
        if (!this.bufferPayload[room]) {
            this.bufferPayload[room] = {};
            this.bufferPayload[room][channel] = null;
        }

        if (this.bufferPayload[room][channel]) {
            this.bufferPayload[room][channel].push(_payload);
        } else {
            this.bufferPayload[room][channel] = [_payload];
        }
    }

    publishToFrontEnd(channel, payload, room) {
        this.pushNotificationToBuffer(channel, payload, room);
        return this._dispatch();
    }

}



/**
 * Retrieves the BufferNotifications singleton instance.
 * 
 * @returns {BufferNotifications} - The singleton instance.
 */
let bufferNotifications;
async function getInstance() {
  if (!bufferNotifications) {
    console.log('====> Creating In WebSocket Notification Buffer instance');
    try {
        let webSocketService = await socketService.getInstance();
        bufferNotifications = new BufferNotifications(PERIOD, webSocketService);
    } catch (error) {
        console.error('Failed to initialize BufferNotifications:', error);
        throw error; 
    }
  }
  return bufferNotifications;
}


module.exports.getInstance = getInstance;
