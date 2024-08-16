// ----------------------------------------------------------------------------
// Socket.io server setup
// ----------------------------------------------------------------------------
var socket_io = require('socket.io');
var http = require('http');
const { logData} = require('../modules/systemlog.js');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'keyboard_kitten';
const SOCKET_PORT = process.env.SOCKET_PORT || 5002

const conf = {
    port: SOCKET_PORT,
    socketIo: {
        path: '',
        serveClient: false,
    }
};


let io;
function startWebSocketServer(port) {
    // return new Promise((resolve, reject) => {
        // Create an HTTP default server
        if (io) {
            return io;
            return resolve(io);
        }
        const webSocketServer = http.createServer().listen(port, (err) => {
            if (err) {
                reject(err);
                return;
            }

        // Create the socket server
        io = socket_io(webSocketServer, conf.socketIo);
        console.log("io server")
        console.log("io server")
        console.log("io server")
        console.log("io server")

        io.sockets.on('connection', function (socket) {
            let clientToken = null;
            if (socket.handshake.query && socket.handshake.query.token) {
                clientToken = socket.handshake.query.token;
            }
            if (socket.handshake.auth && socket.handshake.auth.token) {
                clientToken = socket.handshake.auth.token;
            }
            if (!clientToken) {
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
            console.log('Client connected id', socket.id);

            // Join room
            socket.join('all_users');
        });
        return io;
            resolve(io);
        });
    // });
}

io = startWebSocketServer(SOCKET_PORT)

const unauthorizeClient = (socket) => {
    console.log('Client disconnected id', socket.id);
    logData.addLog('helyos_core', null, 'warn',
    `Client application tried to connect to websocket ${socket.id} with invalid token`);
    socket.emit('unauthorized', 'Invalid token');
    socket.disconnect(true);
    return;
}



function dispatchAllBufferedMessages(bufferPayload){
    for(let channel in bufferPayload){
        sendUpdatesToFrontEnd(channel,bufferPayload[channel]);
        bufferPayload[channel]=null;
    }
}


function sendUpdatesToFrontEnd(channel,msg=null){
    if (!io){
        console.warn("socket.io is not defined, start the websocket server");
        io = startWebSocketServer(SOCKET_PORT);
        return

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
module.exports.startWebSocketServer = startWebSocketServer;
module.exports.io = io;