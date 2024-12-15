
// Agent Interactions
const CREATE_RBMQ_ACCOUNTS = process.env.CREATE_RBMQ_ACCOUNTS || "True";
const MESSAGE_RATE_LIMIT = parseInt(process.env.MESSAGE_RATE_LIMIT || 150);
const MESSAGE_UPDATE_LIMIT = parseInt(process.env.MESSAGE_UPDATE_LIMIT || 20);
const AGENT_IDLE_TIME_OFFLINE = process.env.AGENT_IDLE_TIME_OFFLINE || 10; // Time of inactivity in seconds to consider an agent offline.
const DB_BUFFER_TIME = parseInt(process.env.DB_BUFFER_TIME || 1000);


// RabbitMQ configurations
const PREFETCH_COUNT = parseInt(process.env.PREFETCH_COUNT) || 100; // Number of messages to prefetch from the broker.
const TTL_VISUAL_MSG = parseInt(process.env.TTL_VISUAL_MSG) || 2000; // Time to live for visualization messages in ms.
const TTL_STATE_MSG = parseInt(process.env.TTL_STATE_MSG) || 360000; // Time to live for state messages in ms.

const RBMQ_HOST = process.env.RBMQ_HOST;
const RBMQ_API_PORT = process.env.RBMQ_API_PORT || 15672;
const RBMQ_CNAME = process.env.RBMQ_CNAME || RBMQ_HOST;
const RBMQ_ADMIN_USERNAME = process.env.RBMQ_ADMIN_USERNAME || 'guest';
const RBMQ_ADMIN_PASSWORD = process.env.RBMQ_ADMIN_PASSWORD || 'guest';
const RBMQ_VHOST = process.env.RBMQ_VHOST || '%2F';

const RBMQ_USERNAME = process.env.RBMQ_USERNAME || RBMQ_ADMIN_USERNAME;
const RBMQ_PASSWORD = process.env.RBMQ_PASSWORD || RBMQ_ADMIN_PASSWORD;
const RBMQ_SSL = (process.env.RBMQ_SSL || "False") === "True";
const RBMQ_API_SSL = (process.env.RBMQ_API_SSL || process.env.RBMQ_SSL || "False") === "True";

const TLS_REJECT_UNAUTHORIZED = (process.env.TLS_REJECT_UNAUTHORIZED || "True") === "True";
if (!TLS_REJECT_UNAUTHORIZED) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0; }

const API_PROTOCOL = RBMQ_API_SSL ? 'https' : 'http';
const RBMQ_PROTOCOL = RBMQ_SSL ? 'amqps' : 'amqp';
const RBMQ_CERTIFICATE = RBMQ_SSL ? fs.readFileSync('/etc/helyos/.ssl_keys/ca_certificate.pem') : null;

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
module.exports = {
    // Agent Interactions
    CREATE_RBMQ_ACCOUNTS,
    MESSAGE_RATE_LIMIT,
    MESSAGE_UPDATE_LIMIT,
    AGENT_IDLE_TIME_OFFLINE,
    DB_BUFFER_TIME,

    // RabbitMQ Configurations
    PREFETCH_COUNT,
    TTL_VISUAL_MSG,
    TTL_STATE_MSG,

    RBMQ_HOST,
    RBMQ_API_PORT,
    RBMQ_CNAME,
    RBMQ_ADMIN_USERNAME,
    RBMQ_ADMIN_PASSWORD,
    RBMQ_VHOST,

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
    AGENTS_MQTT_EXCHANGE
};