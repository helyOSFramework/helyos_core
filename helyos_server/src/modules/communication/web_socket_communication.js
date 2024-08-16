

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
                .then( inMemDB => {
                                this._get_latest_updated_data(inMemDB);
                                this._dispatch();
                })},
                 bufferRetainTime);
        }

    _dispatch() {
        socketService.dispatchAllBufferedMessages(this.bufferPayload);
    }

    async _get_latest_updated_data(inMemDB) {
        if(!inMemDB) return;
        const agents = await inMemDB.getHashesByPattern('agents:*');
        // console.log("agentsagents")
        // console.log(agents['agents:Ab34069fc5-fdgs-434b-b87e-f19c5435113']['id'])
        // console.log(agents['agents:Ab34069fc5-fdgs-434b-b87e-f19c5435113']['uuid'])
        // console.log("agentsagents")
        const agents_buffer = await inMemDB.getHashesByPattern('agents_buffer:*');
        // console.log("agents_buffer")
        // console.log(agents_buffer)
        // console.log("agents_buffer")
        const map_objects = await inMemDB.getHashesByPattern('map_objects:*');
        const map_objects_buffer = await inMemDB.getHashesByPattern('map_objects_buffer:*');



        for (const key in agents) { 
            if( agents[key].id == null) {
                logData.addLog('agent', {uuid:key}, 'error', `MemDB error, id not registered`);
                console.log('MemDB error, id not registered');
                continue; 
            }
            let agent = agents_buffer[key];
            if(!agent) {
                const {id, uuid, x, y, z, orientations, sensors, last_message_time} = agents[key];
                agent = {id, uuid, x, y, z, orientations, sensors, last_message_time};                 
            } 
            agent['msg_per_sec'] = agents[key]['msg_per_sec'];
            const webSocketNotification = {'agent_id':agents[key].id,'tool_id':agents[key].id, ...agent };
            this.pushNotificationToFrontEnd('new_agent_poses', webSocketNotification);
        }

        const now = new Date();
        for (const key in map_objects) { 
            if(now - map_objects[key]['last_message_time'] < 2*this.bufferRetainTime) {
                    let mapObject = map_objects_buffer[key];
                    if(!mapObject) {
                        mapObject = map_objects[key];                
                    } 
                    const webSocketNotification = {'map_object': mapObject };
                    this.pushNotificationToFrontEnd('yard_updates', webSocketNotification);
                }
            }

    }

    pushNotificationToFrontEnd(channel, payload) {
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
}

const bufferNotifications = new BufferNotifications(PERIOD);
module.exports.bufferNotifications = bufferNotifications;
