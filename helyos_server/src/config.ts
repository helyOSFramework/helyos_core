import fs from 'fs';


// helyOS Integration
const PGHOST = process.env.PGHOST;
const PGPORT = process.env.PGPORT;
const PGDATABASE = process.env.PGDATABASE;
const PGPASSWORD = process.env.PGPASSWORD; // Not exported.

if (!PGHOST || !PGPORT || !PGDATABASE) {
    console.error('====> Error: PGHOST, PGPORT, and PGDATABASE must be defined.');
    process.exit(1);
}

const RBMQ_HOST = process.env.RBMQ_HOST;
const RBMQ_PORT = process.env.RBMQ_PORT;
const RBMQ_VHOST = process.env.RBMQ_VHOST || '%2F';

if (!RBMQ_HOST) {
    console.error('====> Error: RBMQ_HOST must be defined.');
    process.exit(1);
}

const DASHBOARD_PORT = 8080;
const SOCKET_PORT = process.env.SOCKET_PORT || 5002;
const GQLPORT = process.env.GQLPORT || 500;


const JWT_SECRET = process.env.JWT_SECRET || process.env.PGPASSWORD;
const postgraphileRolePassword = process.env.PGPASSWORD;


// helyOS Scalability
const NUM_THREADS = parseInt(process.env.NUM_THREADS || '1');
let HELYOS_REPLICA: boolean | string = process.env.HELYOS_REPLICA || 'false';
HELYOS_REPLICA = HELYOS_REPLICA.toLowerCase() === 'true';

const REDIS_HOST = process.env.REDIS_HOST || '';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

const replicaOrMultiThread = HELYOS_REPLICA || (NUM_THREADS > 1)
if (replicaOrMultiThread && !process.env.REDIS_HOST) {
    const errorMessage = '====> Error: REDIS host not defined. Please define the REDIS host in your environment variables or set NUM_THREADS=1 and HELYOS_REPLICA=false.';
    console.error(errorMessage);
    process.exit(1);
}


let SOCKET_IO_ADAPTER = process.env.SOCKET_IO_ADAPTER || 'none';
if (SOCKET_IO_ADAPTER !== 'redis') {
    if (HELYOS_REPLICA) {
        console.warn(`====> HELYOS_REPLICA is true; SOCKET_IO_ADAPTER will be set to "redis".`);
        SOCKET_IO_ADAPTER = 'redis';

    } else {
        SOCKET_IO_ADAPTER = NUM_THREADS > 1 ? 'cluster' : 'none';
        console.warn(`====> SOCKET_IO_ADAPTER set to ${SOCKET_IO_ADAPTER}. Threads: ${NUM_THREADS}`);
    }
}

if (SOCKET_IO_ADAPTER === 'redis' && !REDIS_HOST) {
    console.error(`====> Error: Socket.IO adapter is set to 'redis'. To utilize helyOS core replicas for horizontal scaling,` + 
                  `you must connect the helyOS core to REDIS by providing a valid REDIS_HOST.`);
    process.exit(1);
}



// Agent Interactions
const CREATE_RBMQ_ACCOUNTS = (process.env.CREATE_RBMQ_ACCOUNTS || "True").toLowerCase() === 'true';
const MESSAGE_RATE_LIMIT = parseInt(process.env.MESSAGE_RATE_LIMIT || '150');
const MESSAGE_UPDATE_LIMIT = parseInt(process.env.MESSAGE_UPDATE_LIMIT || '20');
const AGENT_IDLE_TIME_OFFLINE = process.env.AGENT_IDLE_TIME_OFFLINE || 10; // Time of inactivity in seconds to consider an agent offline.
const DB_BUFFER_TIME = parseInt(process.env.DB_BUFFER_TIME || '1000');
const WAIT_AGENT_STATUS_PERIOD = parseInt(process.env.WAIT_AGENT_STATUS_PERIOD || '20') * 1000;
const ENCRYPT = process.env.ENCRYPT;


const AGENT_AUTO_REGISTER_TOKEN = process.env.AGENT_AUTO_REGISTER_TOKEN;
const AGENT_REGISTRATION_TOKEN = process.env.AGENT_REGISTRATION_TOKEN || AGENT_AUTO_REGISTER_TOKEN;

// RabbitMQ configurations
const PREFETCH_COUNT = parseInt(process.env.PREFETCH_COUNT|| '100'); // Number of messages to prefetch from the broker.
const TTL_VISUAL_MSG = parseInt(process.env.TTL_VISUAL_MSG || '2000'); // Time to live for visualization messages in ms.
const TTL_STATE_MSG = parseInt(process.env.TTL_STATE_MSG || '360000'); // Time to live for state messages in ms.


const RBMQ_API_PORT = process.env.RBMQ_API_PORT || 15672;
const RBMQ_CNAME = process.env.RBMQ_CNAME || RBMQ_HOST;
const RBMQ_ADMIN_USERNAME = process.env.RBMQ_ADMIN_USERNAME || 'guest';
const RBMQ_ADMIN_PASSWORD = process.env.RBMQ_ADMIN_PASSWORD || 'guest';

const RBMQ_USERNAME = process.env.RBMQ_USERNAME || RBMQ_ADMIN_USERNAME;
const RBMQ_PASSWORD = process.env.RBMQ_PASSWORD || RBMQ_ADMIN_PASSWORD;
const RBMQ_SSL = (process.env.RBMQ_SSL || "False").toLowerCase() === "true";
const RBMQ_API_SSL = (process.env.RBMQ_API_SSL || process.env.RBMQ_SSL || "False").toLowerCase() === "true";

const TLS_REJECT_UNAUTHORIZED = (process.env.TLS_REJECT_UNAUTHORIZED || "True").toLowerCase() === "true";
if (!TLS_REJECT_UNAUTHORIZED) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; }

const API_PROTOCOL = RBMQ_API_SSL ? 'https' : 'http';
const RBMQ_PROTOCOL = RBMQ_SSL ? 'amqps' : 'amqp';
const RBMQ_CERTIFICATE = RBMQ_SSL ? fs.readFileSync('/etc/helyos/.ssl_keys/ca_certificate.pem') : '';

const CHECK_IN_QUEUE = process.env.CHECK_IN_QUEUE || 'agent_checkin_queue';
const AGENT_UPDATE_QUEUE = process.env.AGENT_UPDATE_QUEUE || 'agent_update_queue';
const AGENT_VISUALIZATION_QUEUE = process.env.AGENT_VISUALIZATION_QUEUE || 'agent_visualization_queue';
const YARD_VISUALIZATION_QUEUE = process.env.YARD_VISUALIZATION_QUEUE || 'yard_visualization_queue';

const AGENT_STATE_QUEUE = process.env.AGENT_STATE_QUEUE || 'agent_state_queue';
const AGENT_MISSION_QUEUE = process.env.AGENT_MISSION_QUEUE || 'agent_mission_queue';
const SUMMARY_REQUESTS_QUEUE = 'agent_data_requests';
const AGENTS_UL_EXCHANGE = process.env.AGENTS_UL_EXCHANGE || 'xchange_helyos.agents.ul';
const AGENTS_DL_EXCHANGE = process.env.AGENTS_DL_EXCHANGE || 'xchange_helyos.agents.dl';
const ANONYMOUS_EXCHANGE = process.env.ANONYMOUS_EXCHANGE || 'xchange_helyos.agents.anonymous';
const AGENTS_MQTT_EXCHANGE = process.env.AGENTS_MQTT_EXCHANGE || 'xchange_helyos.agents.mqtt'; //amq.topic' 





// Export all variables
export default  {
    PGHOST,
    PGPORT,
    PGDATABASE,

    SOCKET_PORT,
    SOCKET_IO_ADAPTER,
    DASHBOARD_PORT,
    GQLPORT,
    JWT_SECRET,
    postgraphileRolePassword,

    NUM_THREADS,
    HELYOS_REPLICA,
    // Agent Interactions
    CREATE_RBMQ_ACCOUNTS,
    MESSAGE_RATE_LIMIT,
    MESSAGE_UPDATE_LIMIT,
    AGENT_IDLE_TIME_OFFLINE,
    DB_BUFFER_TIME,
    WAIT_AGENT_STATUS_PERIOD,
    ENCRYPT,
    AGENT_REGISTRATION_TOKEN,

    // RabbitMQ Configurations
    PREFETCH_COUNT,
    TTL_VISUAL_MSG,
    TTL_STATE_MSG,

    RBMQ_HOST,
    RBMQ_PORT,
    RBMQ_VHOST,

    RBMQ_API_PORT,
    RBMQ_CNAME,
    RBMQ_ADMIN_USERNAME,
    RBMQ_ADMIN_PASSWORD,

    RBMQ_USERNAME,
    RBMQ_PASSWORD,
    RBMQ_SSL,
    RBMQ_API_SSL,

    TLS_REJECT_UNAUTHORIZED,
    API_PROTOCOL,
    RBMQ_PROTOCOL,
    RBMQ_CERTIFICATE,

    CHECK_IN_QUEUE,
    AGENT_UPDATE_QUEUE,
    AGENT_VISUALIZATION_QUEUE,
    YARD_VISUALIZATION_QUEUE,

    AGENT_STATE_QUEUE,
    AGENT_MISSION_QUEUE,
    SUMMARY_REQUESTS_QUEUE,
    AGENTS_UL_EXCHANGE,
    AGENTS_DL_EXCHANGE,
    ANONYMOUS_EXCHANGE,
    AGENTS_MQTT_EXCHANGE, 

    REDIS_HOST,
    REDIS_PORT,
    REDIS_PASSWORD

};
