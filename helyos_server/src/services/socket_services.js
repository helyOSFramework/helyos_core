// ----------------------------------------------------------------------------
// Socket.io server setup
// ----------------------------------------------------------------------------
const socket_io = require('socket.io');
const { createAdapter: createClusterAdapter } = require('@socket.io/cluster-adapter');
const { createAdapter: createRedisAdapter } = require('@socket.io/redis-adapter');
const redisAccessLayer = require('./in_mem_database/redis_access_layer.js');
const http = require('http');
const { logData} = require('../modules/systemlog.js');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || process.env.PGPASSWORD;
const SOCKET_PORT = process.env.SOCKET_PORT || 5002

// MULTI-INSTANCES ENVIRONMENT
let SOCKET_IO_ADAPTER = process.env.SOCKET_IO_ADAPTER || 'cluster'
const NUM_THREADS  =  parseInt(process.env.NUM_THREADS || '1');
if (SOCKET_IO_ADAPTER !== 'redis') {
    SOCKET_IO_ADAPTER = NUM_THREADS > 1 ? 'cluster':'none';
    console.warn(`====> socket socket io adtaper set to ${SOCKET_IO_ADAPTER}. Threads: ${NUM_THREADS}`)
}


const conf = {
    port: SOCKET_PORT,
    socketIo: {
        path: '',
        serveClient: false,
    }
};


class WebSocketService {

    constructor() {
        if (WebSocketService.instance){
            return WebSocketService.instance;
        }

        console.log("######## Creating socket io service...");
        self._webSocketServer = http.createServer();
        self.io = socket_io(self._webSocketServer, conf.socketIo);

        self.io.sockets.on('connection', function (socket) {
            let clientToken = null;
            if (socket.handshake.query && socket.handshake.query.token){
                clientToken = socket.handshake.query.token;
            }
            if (socket.handshake.auth && socket.handshake.auth.token){
                clientToken = socket.handshake.auth.token;
            }
            if(!clientToken) {
                unauthorizeClient(socket);
                return;
            }
            try {
                socket.decoded = jwt.verify(clientToken, JWT_SECRET);;
            } catch (e) {
                unauthorizeClient(socket);
                return;
            }
            logData.addLog('helyos_core', null, 'warn', `Client application connected to websocket ${socket.id}`);
            // Join room
            socket.join('all_users');
        });
    }



    async initiateWebSocket() { 
        if (SOCKET_IO_ADAPTER === 'redis') {
            await redisAccessLayer.ensureConnected();
            const pubClient = redisAccessLayer.pubForSocketIOServer;
            const subClient= redisAccessLayer.subForSocketIOServer;    
            self.io.adapter(createRedisAdapter(pubClient, subClient));
        } 
        if (SOCKET_IO_ADAPTER === 'cluster') {
            self.io.adapter(createClusterAdapter());
        }    
    }


    dispatchAllBufferedMessages(bufferPayload){
        for(let channel in bufferPayload){
            sendUpdatesToFrontEnd(channel,bufferPayload[channel]);
            bufferPayload[channel]=null;
        }
    }




}


let io;
async function setWebSocketServer() {
    if (io) { 
        return io; 
    }
    console.log("######## Creating socket io service...");
    // Create an HTTP default server
    const _webSocketServer = http.createServer();
    // Create the socket server
    io = socket_io(_webSocketServer, conf.socketIo);

    if (SOCKET_IO_ADAPTER === 'redis') {
        await redisAccessLayer.ensureConnected();
        const pubClient = redisAccessLayer.pubForSocketIOServer;
        const subClient= redisAccessLayer.subForSocketIOServer;    
        io.adapter(createRedisAdapter(pubClient, subClient));
    } 
    
    if (SOCKET_IO_ADAPTER === 'cluster') {
        io.adapter(createClusterAdapter());
    }    


    io.sockets.on('connection', function (socket) {
        let clientToken = null;
        if (socket.handshake.query && socket.handshake.query.token){
            clientToken = socket.handshake.query.token;
        }
        if (socket.handshake.auth && socket.handshake.auth.token){
            clientToken = socket.handshake.auth.token;
        }
        if(!clientToken) {
            unauthorizeClient(socket);
            return;
        }
        let decoded;
        try {
            decoded = jwt.verify(clientToken, JWT_SECRET);
            socket.decoded = decoded;
        } catch (e) {
            unauthorizeClient(socket);
            return;
        }

        logData.addLog('helyos_core', null, 'warn', `Client application connected to websocket ${socket.id}`);

        // Join room
        socket.join('all_users');
    });

    return io;
}



const unauthorizeClient = (socket) => {
    console.log('Client disconnected id', socket.id);
    logData.addLog('helyos_core', null, 'warn',
    `Client application tried to connect to websocket ${socket.id} with invalid token`);
    socket.emit('unauthorized', 'Invalid token');
    socket.disconnect(true);
}

function dispatchAllBufferedMessages(bufferPayload){
    for(let channel in bufferPayload){
        sendUpdatesToFrontEnd(channel,bufferPayload[channel]);
        bufferPayload[channel]=null;
    }
}


function sendUpdatesToFrontEnd(channel, msg=null){
    if (!io){
        console.warn("socket.io is not defined, start the websocket server", msg);
        return;
    } 
    if (!msg || msg==[]) return;
    try {
        const room = 'all_users';
        io.to(room).emit(channel, msg);
    } catch (e) {
        console.error("error message from Postgress to Front-end", e)
    }
}


module.exports.sendUpdatesToFrontEnd = sendUpdatesToFrontEnd;
module.exports.dispatchAllBufferedMessages = dispatchAllBufferedMessages;
module.exports.setWebSocketServer = setWebSocketServer;
module.exports.SOCKET_IO_ADAPTER = SOCKET_IO_ADAPTER;
module.exports.io = io;