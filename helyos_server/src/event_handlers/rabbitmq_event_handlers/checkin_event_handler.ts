// Services imports
import rabbitMQServices from '../../services/message_broker/rabbitMQ_services';
import * as DatabaseService  from '../../services/database/database_services';
import * as memDBService from '../../services/in_mem_database/mem_database_service';
import config from '../../config';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { logData } from '../../modules/systemlog';
import { AGENT_STATUS } from '../../modules/data_models';

let HELYOS_PUBLIC_KEY = '';
let HELYOS_PRIVATE_KEY = '';

try {
    HELYOS_PRIVATE_KEY = fs.readFileSync('/etc/helyos/.ssl_keys/helyos_private.key', 'utf8');
    HELYOS_PUBLIC_KEY = fs.readFileSync('/etc/helyos/.ssl_keys/helyos_public.key', 'utf8');
} catch (error) {
    console.warn('Private and/or public key not defined');
}

// Helpers
const MESSAGE_VERSION = rabbitMQServices.MESSAGE_VERSION;
const { RBMQ_CERTIFICATE } = config;

const isYardUIdRegistered = async (uid: string): Promise<number> => {
    const databaseServices = await DatabaseService.getInstance();
    const result = await databaseServices.yards.get('uid', uid, ['id']);
    return result && result.length ? result[0].id : 0;
};

// Interfaces
interface CheckInData {
    yard_id?: number;
    yard_uid?: string;
    status?: string;
    pose?: {
        x?: number;
        y?: number;
        z?: number;
        orientations?: number[];
    };
    name?: string;
    plate?: string;
    public_key?: string;
    agent_type?: string;
    data_format?: string;
    unit?: string;
    coordinate_frame?: string;
    reference_point?: string;
    factsheet?: string;
    geometry?: string;
}

interface MsgProps {
    replyTo?: string;
    userId?: string;
}

interface Agent {
    id: number;
    uuid: string;
    rbmq_username: string;
    rbmq_encrypted_password: string;
    public_key?: string;
    message_channel?: string;
    yard_id?: number;
    has_rbmq_account?: boolean;
}

interface AgentUpdate {
    [key: string]: any;
}

// Functions
async function agentCheckIn(uuid: string,data: {body:CheckInData}, msgProps: MsgProps,registeredAgent: Agent | null,replyExchange: string): Promise<Agent> {
    const databaseServices = await DatabaseService.getInstance();

    try {
        const agent = await processAgentCheckIn(uuid, data, msgProps, registeredAgent);

        let replyTo: string | null | undefined = msgProps.replyTo ? msgProps.replyTo : agent.message_channel;
        if (replyTo) replyTo = replyTo.replace(/\//g, '.');

        const yard = await databaseServices.yards.get_byId(agent.yard_id!, ['id', 'lat', 'lon', 'alt', 'map_data']);

        const mapObjects = await databaseServices.map_objects.get('yard_id', yard.id).then((mapObjects) =>
            mapObjects.map((obj: any) => ({
                type: obj.type,
                metadata: obj.metadata,
                data: obj.data,
            }))
        );

        const message = JSON.stringify({
            type: 'checkin',
            uuid: agent.uuid,
            body: {
                agentId: agent.id,
                yard_uid: yard.uid,
                map: {
                    origin: { lat: yard.lat, lon: yard.lon, alt: yard.alt },
                    map_objects: mapObjects,
                    id: yard.id,
                    uid: yard.uid,
                },
                message: 'check-in successful',
                rbmq_username: agent.rbmq_username,
                rbmq_encrypted_password: agent.rbmq_encrypted_password,
                rbmq_password: agent.rbmq_encrypted_password,
                ca_certificate: RBMQ_CERTIFICATE,
                helyos_public_key: HELYOS_PUBLIC_KEY,
                password_encrypted: false,
                response_code: '200',
            },
            _version: MESSAGE_VERSION,
        });

        console.log('================== checkin response message to =======================');
        console.log(`${uuid} => ${agent.uuid}`);
        console.log('======================================================================');

        const publicKey = agent.public_key || registeredAgent?.public_key;

        rabbitMQServices.sendEncryptedMsg(replyTo as string, message, publicKey);
        rabbitMQServices.sendEncryptedMsg(null, message, publicKey, replyTo, replyExchange);

        return agent;
    } catch (error) {
        console.error('Error in agentCheckIn:', error);

        const message = JSON.stringify({
            type: 'checkin',
            uuid,
            body: {
                message: 'internal error',
                response_code: '500',
            },
        });

        const replyTo = msgProps.replyTo || uuid;

        rabbitMQServices.sendEncryptedMsg(replyTo, message);
        if (registeredAgent?.public_key) {
            rabbitMQServices.sendEncryptedMsg(null, message, registeredAgent.public_key, replyTo, replyExchange);
        }

        throw error;
    }
}


async function processAgentCheckIn(uuid: string, data: {body: CheckInData}, msgProps: MsgProps, registeredAgent: Agent | null): Promise<Agent> {
    const databaseServices = await DatabaseService.getInstance();

    // 1 - PARSE INPUT
    const checkinData = data.body; 
    const checkingYard = checkinData.yard_id || checkinData.yard_uid; // Compatibility for agent versions < 2.0
    const isAnonymous = msgProps.userId === 'anonymous';

    // 2 - VALIDATIONS
    if (!registeredAgent) {
        // If the agent is not registered, create a new record with a temporary name and update it
        await databaseServices.agents
            .insert({ uuid, name: 'agent-', connection_status: 'online' })
            .then((agentId) =>
                databaseServices.agents.update_byId(agentId, {
                    name: `agent-${agentId}`,
                    code: `agent-${agentId}`,
                })
            );
    }

    if (!checkingYard) {
        // Throw an error if no yard UID is provided
        logData.addLog('agent', { uuid }, 'error', 'Agent failed to check in; yard UID is missing');
        throw { msg: 'Agent failed to check in; yard UID is missing', code: 'YARD-400' };
    }

    const yardId = await isYardUIdRegistered(checkingYard.toString());
    if (!yardId) {
        // Throw an error if the specified yard is not registered
        console.log('=========================================');
        console.log('Yard was not registered;');
        console.log('=========================================');
        throw { msg: `Yard was not registered; ${checkinData.yard_uid}`, code: 'YARD-404' };
    }

    // 3 - CHECK-IN
    const agentUpdate: AgentUpdate = { uuid }; // Create an update object for the agent
    agentUpdate.last_message_time = new Date();

    if (isAnonymous) {
        // If the agent is anonymous, create a RabbitMQ account for it
        const credentials = await createAgentRbmqAccount({ uuid });
        agentUpdate.id = credentials.id;
        agentUpdate.rbmq_username = credentials.rbmq_username;
        agentUpdate.rbmq_encrypted_password = credentials.rbmq_encrypted_password;
        agentUpdate.has_rbmq_account = credentials.has_rbmq_account;
    }

    agentUpdate.yard_id = yardId;
    agentUpdate.status = checkinData.status || AGENT_STATUS.FREE;
    agentUpdate.message_channel = uuid;

    if ('public_key' in checkinData) {
        // Update the public key if provided
        logData.addLog('agent', { uuid }, 'info', 'Agent public key updated');
        agentUpdate.public_key = checkinData.public_key;
    }

    // Backward compatibility: Handle agent versions < 1.5
    if (checkinData.name || checkinData.plate) {
        agentUpdate.name = checkinData.name;
        agentUpdate.code = checkinData.name;
    }

    if ('pose' in checkinData) {
        // Update agent pose information if provided
        agentUpdate.x = checkinData.pose?.x;
        agentUpdate.y = checkinData.pose?.y;
        agentUpdate.z = checkinData.pose?.z;
        agentUpdate.orientations = [0];

        if (checkinData.pose?.orientations && checkinData.pose?.orientations.length > 0) {
            agentUpdate.orientation = checkinData.pose.orientations[0];
            agentUpdate.orientations = checkinData.pose.orientations;
        }
    }

    // Handle additional optional fields
    if ('agent_type' in checkinData) {
        agentUpdate.agent_type = checkinData.agent_type;
    }

    if ('data_format' in checkinData) {
        agentUpdate.data_format = checkinData.data_format;
    }

    if ('unit' in checkinData) {
        agentUpdate.unit = checkinData.unit;
    }

    if ('coordinate_frame' in checkinData) {
        agentUpdate.coordinate_frame = checkinData.coordinate_frame;
    }

    if ('reference_point' in checkinData) {
        agentUpdate.reference_point = checkinData.reference_point;
    }

    if ('factsheet' in checkinData) {
        agentUpdate.factsheet = checkinData.factsheet;
    }

    if ('geometry' in checkinData) {
        agentUpdate.geometry = checkinData.geometry;
    }

    // Update the in-memory database and count messages
    const inMemDB = await memDBService.getInstance();
    inMemDB.update('agents', 'uuid', agentUpdate, agentUpdate.last_message_time, 'buffered');
    inMemDB.countMessages('agents_stats', uuid, 'updtPerSecond');

    // Update the database with agent information and fetch the updated record
    return databaseServices.agents
        .updateByConditions({ uuid }, agentUpdate)
        .then(() =>
            databaseServices.agents.get('uuid', uuid, [
                'id',
                'uuid',
                'message_channel',
                'rbmq_username',
                'rbmq_encrypted_password',
                'yard_id',
                'public_key',
            ])
        )
        .then((agents) => agents[0]);
}




const createAgentRbmqAccount = async (agentIdentification: { id?: string; uuid?: string } = {},
    username = '', password = ''): Promise<Agent> => {
    const databaseServices = await DatabaseService.getInstance();

    const agents = await databaseServices.agents.select(agentIdentification);
    const agent = agents[0];
    const generatedPassword = password || uuidv4();
    const generatedUsername = username || agent.uuid;
    const permissions = {
        configure: agent['configure_permissions'],
        write: agent['write_permissions'],
        read: agent['read_permissions']
    }
    const rbmqUsername = agent.rbmq_username || generatedUsername;

    await rabbitMQServices.create_rbmq_user(rbmqUsername, generatedPassword, []);
    await rabbitMQServices.setRBMQUserAtVhost(rbmqUsername, permissions);

    rabbitMQServices.createDebugQueues(agent);

    const hashedPassword = encryptPassword(generatedPassword, agent.pubkey);
    return {
        id: agent.id,
        uuid: agent.uuid,
        rbmq_username: rbmqUsername,
        rbmq_encrypted_password: hashedPassword,
        has_rbmq_account: true,
    };
};

const removeAgentRbmqAccount = async (agentData: Agent): Promise<number> => {
    await rabbitMQServices.remove_rbmq_user(agentData.rbmq_username);
    rabbitMQServices.removeDebugQueues(agentData);
    return 0;
};



const encryptPassword = (passwd: string, pubkey?: string): string => {
    // Implement proper encryption logic here.
    return passwd;
};




export { agentCheckIn, createAgentRbmqAccount, removeAgentRbmqAccount };
