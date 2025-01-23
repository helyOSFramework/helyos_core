import { Server, ServerOptions, Socket } from 'socket.io';
import { createAdapter as createClusterAdapter } from '@socket.io/cluster-adapter';
import { createAdapter as createRedisAdapter } from '@socket.io/redis-adapter';
import * as redisAccessLayer from './in_mem_database/redis_access_layer';
import http from 'http';
import { logData } from '../modules/systemlog';
import jwt from 'jsonwebtoken';
import config from '../config';

// ----------------------------------------------------------------------------
// Socket.io server setup
// ----------------------------------------------------------------------------

const { JWT_SECRET, SOCKET_PORT } = config;
const { SOCKET_IO_ADAPTER, SERVER_PATH_BASE } = config;

const socketPath = SERVER_PATH_BASE? `/${SERVER_PATH_BASE}/socket.io` : '/socket.io';
const conf: Partial<ServerOptions> = {
        path: socketPath,
        serveClient: false,

    };

class WebSocketService {
    private static instance: WebSocketService | null = null;
    private _webSocketServer: http.Server;
    public io: Server;
    socketIOAdapter: string;

    private constructor() {
        if (WebSocketService.instance) {
            return WebSocketService.instance;
        }

        console.log("######## Creating socket io service...");
        this._webSocketServer = http.createServer();
        this.io = new Server(this._webSocketServer, conf);

        this.io.sockets.on('connection', function (socket:Socket) {
            let clientToken: string | string[] | null = null;
            if (socket.handshake.query && socket.handshake.query.token) {
                clientToken = socket.handshake.query.token;
            }
            if (socket.handshake.auth && socket.handshake.auth.token) {
                clientToken = socket.handshake.auth.token;
            }

            const room: string = socket.handshake.auth?.room || 'all';

            if (!clientToken) {
                unauthorizeClient(socket);
                return;
            }
            try {
                (socket as any).decoded = jwt.verify(clientToken as string, JWT_SECRET as string);
            } catch (e) {
                unauthorizeClient(socket);
                return;
            }
            logData.addLog('helyos_core', null, 'warn', `Client application connected to websocket ${socket.id} joined to room:${room}`);
            // Join room
            socket.join(room);
        });
    }

    public static async getInstance(): Promise<WebSocketService> {
        if (!WebSocketService.instance) {
            console.log('====> Creating and initiating WebSocketService Instance');
            try {
                WebSocketService.instance = new WebSocketService();
                await WebSocketService.instance.initiateWebSocket();
            } catch (error) {
                console.error('Failed to initialize WebSocketService:', error);
                throw error;
            }
        }
        return WebSocketService.instance;
    }

    private async initiateWebSocket(): Promise<void> {
        this.socketIOAdapter = SOCKET_IO_ADAPTER;
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

    public dispatchAllBufferedMessages(bufferPayload: { [room: string]: { [channel: string]: any } }): void {
        for (let room in bufferPayload) {
            const roomChannels = bufferPayload[room];
            for (let channel in roomChannels) {
                this.sendUpdatesToFrontEnd(channel, roomChannels[channel], room);
                roomChannels[channel] = null;
            }
        }
    }

    private sendUpdatesToFrontEnd(channel: string, msg: any | null, room: string): void {
        if (!this.io) {
            console.warn("socket.io is not defined, start the websocket server", msg);
            return;
        }
        if (!msg) return;
        try {
            if (room !== 'all') this.io.to(room).emit(channel, msg);
            this.io.to('all').emit(channel, msg);
        } catch (e) {
            console.error("error message from Postgress to Front-end", e)
        }
    }
}

const unauthorizeClient = (socket: Socket): void => {
    console.log('Client disconnected id', socket.id);
    logData.addLog('helyos_core', null, 'warn',
        `Client application tried to connect to websocket ${socket.id} with invalid token`);
    socket.emit('unauthorized', 'Invalid token');
    socket.disconnect(true);
}

export { WebSocketService, unauthorizeClient, SOCKET_IO_ADAPTER };
