

const socketService = require('../../services/socket_services.js');
const utils = require('../../modules/utils.js');
const memDBServices = require('../../services/in_mem_database/mem_database_service');
const { logData } = require('../systemlog.js');
const PERIOD = 100;

// Buffer Notifications to avoid flooding front-end with messages
class BufferNotifications {
    bufferRetainTime = 500;
    bufferPayload = {}; 
    eventDispatchBuffer = null;

    constructor(bufferRetainTime) {
		this.bufferRetainTime = bufferRetainTime;
        this.bufferPayload = {};
        this.eventDispatchBuffer = setInterval(() => {
                memDBServices.getInstance()
                .then( (inMemDB) => this._get_latest_updated_data(inMemDB))
                .then( () =>  this._dispatch());
                },
                 bufferRetainTime);
        }

    _dispatch() {
        socketService.dispatchAllBufferedMessages(this.bufferPayload);
    }

    _get_latest_updated_data(inMemDB) {
        if(!inMemDB) return;
        for (const key in inMemDB.agents) { 
            if(inMemDB.agents[key].id == null) {
                logData.addLog('agent', {uuid:key}, 'error', `MemDB error, id not registered`);
                console.log('MemDB error, id not registered');
                continue; 
            }
            let agent = inMemDB.agents_buffer[key];
            if(!agent) {
                const {id, uuid, x, y, z, orientations, sensors, last_message_time} = inMemDB.agents[key];
                agent = {id, uuid, x, y, z, orientations, sensors, last_message_time};                 
            } 
            agent['msg_per_sec'] = inMemDB.agents[key]['msg_per_sec'];
            const webSocketNotification = {'agent_id':inMemDB.agents[key].id,'tool_id':inMemDB.agents[key].id, ...agent };
            this.pushNotificationToBuffer('new_agent_poses', webSocketNotification);
        }

        const now = new Date();
        for (const key in inMemDB.map_objects) { 
            if(now - inMemDB.map_objects[key]['last_message_time'] < 2*this.bufferRetainTime) {
                    let mapObject = inMemDB.map_objects_buffer[key];
                    if(!mapObject) {
                        mapObject =  inMemDB.map_objects[key];                
                    } 
                    const webSocketNotification =  mapObject;
                    this.pushNotificationToBuffer('map_objects_updates', webSocketNotification);
                }
            }

    }

    pushNotificationToBuffer(channel, payload) {
        let _payload = utils.camelizeAttributes(payload);
        if (!this.bufferPayload) {
            this.bufferPayload = {};
        }
        if (this.bufferPayload[channel]) {
            this.bufferPayload[channel].push(_payload);
        } else {
            this.bufferPayload[channel] = [_payload];
        }
    }

    publishToFrontEnd(channel, payload) {
        this.pushNotificationToBuffer(channel, payload);
        return memDBServices.getInstance()
        .then( (inMemDB) => this._get_latest_updated_data(inMemDB))
        .then( () =>  this._dispatch());
    }

}


const bufferNotifications = new BufferNotifications(PERIOD);
module.exports.bufferNotifications = bufferNotifications;
