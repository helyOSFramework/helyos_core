import databaseServices from '../../services/database/database_services';
import * as memDBService from '../../services/in_mem_database/mem_database_service';
import * as webSocketCommunicaton from '../../modules/communication/web_socket_communication';
import { logData } from '../../modules/systemlog';

interface Pose {
    x: number;
    y: number;
    z: number;
    orientations?: number[];
}

interface ObjMsg {
    status?: string;
    body?: {
        pose?: Pose;
        name?: string;
        code?: string;
        data_format?: string;
        agent_type?: string;
        unit?: string;
        coordinate_frame?: string;
        reference_point?: string;
        sensors?: any;
        is_actuator?: boolean;
        wp_clearance?: any;
        factsheet?: any;
        geometry?: any;
        followers?: string[];
    };
}

interface AgentUpdate {
    uuid: string;
    last_message_time: Date;
    status?: string;
    x?: number;
    y?: number;
    z?: number;
    orientation?: number;
    orientations?: number[];
    name?: string;
    code?: string;
    data_format?: string;
    agent_type?: string;
    unit?: string;
    coordinate_frame?: string;
    reference_point?: string;
    sensors?: any;
    is_actuator?: boolean;
    wp_clearance?: any;
    factsheet?: any;
    geometry?: any;
}

async function agentAutoUpdate(objMsg: ObjMsg, uuid: string, mode: string = 'buffered'): Promise<any[]> {
    const inMemDB = await memDBService.getInstance();

    let agentUpdate: AgentUpdate = { uuid, last_message_time: new Date() };

    const agentInMem = await inMemDB.agents[uuid];
    if (!agentInMem || !agentInMem.id) {
        const ids = await databaseServices.agents.getIds([uuid]);
        await inMemDB.update('agents', 'uuid', { uuid, id: ids[0] }, agentUpdate.last_message_time);
        console.log(`Database query: agent ${uuid} has ID = ${ids[0]}`);
    }

    let msgBody = objMsg.body;

    if (!msgBody) return [];

    if ('pose' in msgBody) {
        agentUpdate.x = msgBody.pose!.x;
        agentUpdate.y = msgBody.pose!.y;
        agentUpdate.z = msgBody.pose!.z;
        if (msgBody.pose!.orientations && msgBody.pose!.orientations.length > 0) {
            agentUpdate.orientation = msgBody.pose!.orientations[0];
            agentUpdate.orientations = msgBody.pose!.orientations;
        }  
    }

    if ('name' in msgBody) {
        agentUpdate.name = msgBody.name;
    }

    if ('code' in msgBody) {
        agentUpdate.code = msgBody.code;
    }

    if ('data_format' in msgBody) {
        agentUpdate.data_format = msgBody.data_format;
    }
    
    if ('agent_type' in msgBody) {
        agentUpdate.agent_type = msgBody.agent_type;
    }

    if ('unit' in msgBody) {
        agentUpdate.unit = msgBody.unit;
    }

    if ('coordinate_frame' in msgBody) {
        agentUpdate.coordinate_frame = msgBody.coordinate_frame;
    }

    if ('reference_point' in msgBody) {
        agentUpdate.reference_point = msgBody.reference_point;
    }

    if ('sensors' in msgBody) {
        agentUpdate.sensors = msgBody.sensors;
    }

    if ('is_actuator' in msgBody) {
        agentUpdate.is_actuator = msgBody.is_actuator;
    }

    if ('wp_clearance' in msgBody) {
        agentUpdate.wp_clearance = msgBody.wp_clearance;
    }

    if ('factsheet' in msgBody) {
        agentUpdate.factsheet = msgBody.factsheet;
    } 

    if ('geometry' in msgBody) {
        agentUpdate.geometry = msgBody.geometry;
    }

    if ('followers' in msgBody) {
        connectFollowersToLeader(uuid, msgBody.followers!);
    }

    if (msgBody.geometry) {
        const qryToolData = await databaseServices.agents.get('uuid', uuid, ['id', 'status']);
        if (qryToolData.length) {
            const toolData = qryToolData[0];
            let webSocketNotification = { id: toolData.id, uuid, geometry: msgBody.geometry, status: toolData.status };
            // bufferNotifications.pushNotificationToBuffer('change_agent_status', webSocketNotification);
        }
    }

    let statsLabel = 'buffered';
    let promises = [inMemDB.update('agents', 'uuid', agentUpdate, agentUpdate.last_message_time, statsLabel)];
    if (mode === 'realtime') {
        promises.push(databaseServices.agents.updateByConditions({ uuid }, agentUpdate)); 
    }
    return Promise.all(promises);
}

async function connectFollowersToLeader(leaderUUID: string, followerUUIDs: string[]): Promise<void> {
    try {
        const newConnectionIds = await databaseServices.connectAgents(leaderUUID, followerUUIDs);
        logData.addLog('agent', { uuid: leaderUUID }, 'info', `Followers connected to this agent # : ${newConnectionIds.length ? newConnectionIds : 'None'}`);
        const followerPatchs = followerUUIDs.map(uuid => ({ uuid, rbmq_username: leaderUUID }));
        await databaseServices.agents.updateMany(followerPatchs, 'uuid');
    } catch (e) {
        logData.addLog('agent', { uuid: leaderUUID }, 'error', `lead-follower connection: ${e}`);
    }
}

export { agentAutoUpdate };