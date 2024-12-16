// ----------------------------------------------------------------------------
// Socket.io server setup
// ----------------------------------------------------------------------------
const socket_io = require('socket.io');
const { createAdapter: createClusterAdapter } = require('@socket.io/cluster-adapter');
const { createAdapter: createRedisAdapter } = require('@socket.io/redis-adapter');
const redisAccessLayer = require('./in_mem_database/redis_access_layer.js');
const http = require('http');
const { logData } = require('../modules/systemlog.js');
const jwt = require('jsonwebtoken');
const config = require('../config.js');

const { JWT_SECRET, SOCKET_PORT } = config;
const { SOCKET_IO_ADAPTER } = config;


const conf = {
    port: SOCKET_PORT,
    socketIo: {
        path: '',
        serveClient: false,
    }
};


class WebSocketService {

    static instance = null;

    constructor() {
        if (WebSocketService.instance) {
            return WebSocketService.instance;
        }

        console.log("######## Creating socket io service...");
        this._webSocketServer = http.createServer();
        this.io = socket_io(this._webSocketServer, conf.socketIo);

        this.io.sockets.on('connection', function (socket) {
            let clientToken = null;
            if (socket.handshake.query && socket.handshake.query.token) {
                clientToken = socket.handshake.query.token;
            }
            if (socket.handshake.auth && socket.handshake.auth.token) {
                clientToken = socket.handshake.auth.token;
            }

            const room = socket.handshake.auth?.room || 'all';

            if (!clientToken) {
                unauthorizeClient(socket);
                return;
            }
            try {
                socket.decoded = jwt.verify(clientToken, JWT_SECRET);;
            } catch (e) {
                unauthorizeClient(socket);
                return;
            }
            logData.addLog('helyos_core', null, 'warn', `Client application connected to websocket ${socket.id} joined to room:${room}`);
            // Join room
            socket.join(room);
        });
    }



    async initiateWebSocket() {
        if (SOCKET_IO_ADAPTER === 'redis') {
            await redisAccessLayer.ensureConnected();
            const pubClient = redisAccessLayer.pubForSocketIOServer;
            const subClient = redisAccessLayer.subForSocketIOServer;
            this.io.adapter(createRedisAdapter(pubClient, subClient));
        }
        if (SOCKET_IO_ADAPTER === 'cluster') {
            this.io.adapter(createClusterAdapter());
        }
    }


    dispatchAllBufferedMessages(bufferPayload) {
        for (let room in bufferPayload) {
            const roomChannels = bufferPayload[room];
            for (let channel in roomChannels) {
                this.sendUpdatesToFrontEnd(channel, roomChannels[channel], room);
                roomChannels[channel] = null;
            }
        }
    }


    sendUpdatesToFrontEnd(channel, msg = null, room) {
        if (!this.io) {
            console.warn("socket.io is not defined, start the websocket server", msg);
            return;
        }
        if (!msg || msg == []) return;
        try {
            if (room !== 'all') this.io.to(room).emit(channel, msg);
            this.io.to('all').emit(channel, msg);
        } catch (e) {
            console.error("error message from Postgress to Front-end", e)
        }
    }

}



const unauthorizeClient = (socket) => {
    console.log('Client disconnected id', socket.id);
    logData.addLog('helyos_core', null, 'warn',
        `Client application tried to connect to websocket ${socket.id} with invalid token`);
    socket.emit('unauthorized', 'Invalid token');
    socket.disconnect(true);
}




/**
 * Retrieves the  WebSocketService singleton instance.
 * 
 * @returns {WebSocketService} - The singleton instance.
 */
let webSocketService;
async function getInstance() {
    if (!webSocketService) {
        console.log('====> Creating and initiating WebSocketService Instance');
        try {
            webSocketService = new WebSocketService();
            await webSocketService.initiateWebSocket();

        } catch (error) {
            console.error('Failed to initialize WebSocketService:', error);
            throw error;
        }
    }
    return webSocketService;
}


module.exports.getInstance = getInstance;
module.exports.SOCKET_IO_ADAPTER = SOCKET_IO_ADAPTER;
module.exports.webSocketService = webSocketService;