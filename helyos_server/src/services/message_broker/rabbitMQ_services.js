const { logData } = require('../../modules/systemlog.js');
// ----------------------------------------------------------------------------
// RabbitMQ client setup
// ----------------------------------------------------------------------------
const MESSAGE_VERSION = '2.0.0';
const crypto = require('crypto');
const fs = require('fs');
const util = require('util');
const rbmqAccessLayer = require('./rabbitMQ_access_layer.js');

const RBMQ_HOST = process.env.RBMQ_HOST;
const RBMQ_PORT = process.env.RBMQ_PORT;
const RBMQ_API_PORT = process.env.RBMQ_API_PORT || 15672;
const RBMQ_CNAME = process.env.RBMQ_CNAME || RBMQ_HOST;
const RBMQ_ADMIN_USERNAME = process.env.RBMQ_ADMIN_USERNAME || 'guest';
const RBMQ_ADMIN_PASSWORD = process.env.RBMQ_ADMIN_PASSWORD || 'guest';
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
const RBMQ_VHOST = process.env.RBMQ_VHOST || '%2F';

const AGENT_STATE_QUEUE = process.env.AGENT_STATE_QUEUE || 'agent_state_queue';
const AGENT_MISSION_QUEUE = process.env.AGENT_MISSION_QUEUE || 'agent_mission_queue';
const SUMMARY_REQUESTS_QUEUE = 'agent_data_requests';
const AGENTS_UL_EXCHANGE = process.env.AGENTS_UL_EXCHANGE || 'xchange_helyos.agents.ul';
const AGENTS_DL_EXCHANGE = process.env.AGENTS_DL_EXCHANGE || 'xchange_helyos.agents.dl';
const ANONYMOUS_EXCHANGE = process.env.ANONYMOUS_EXCHANGE || 'xchange_helyos.agents.anonymous';
const AGENT_MQTT_EXCHANGE = process.env.AGENT_MQTT_EXCHANGE || 'xchange_helyos.agents.mqtt'; //amq.topic' 


const sslOptions = RBMQ_SSL ? {
    ca: [RBMQ_CERTIFICATE],
    servername: RBMQ_CNAME,

} : {};



const CREATE_RBMQ_ACCOUNTS = process.env.CREATE_RBMQ_ACCOUNTS || "True";
const ANY_AGENT_RBMQ_USERNAME = process.env.ANY_AGENT_RBMQ_USERNAME || null;
const ANY_AGENT_RBMQ_PASSWORD = process.env.ANY_AGENT_RBMQ_PASSWORD || null;


const ENCRYPT = process.env.ENCRYPT;
let HELYOS_PUBLIC_KEY = '', HELYOS_PRIVATE_KEY = '';
try {
    HELYOS_PRIVATE_KEY = fs.readFileSync('/etc/helyos/.ssl_keys/helyos_private.key');
    HELYOS_PUBLIC_KEY = fs.readFileSync('/etc/helyos/.ssl_keys/helyos_public.key');
} catch (error) {
    console.warn('Private and/or public key not defined');
}

const urlObj = (username = RBMQ_USERNAME, password = RBMQ_PASSWORD) => ({
    hostname: RBMQ_HOST,
    port: RBMQ_PORT,
    username: username,
    password: password,
    protocol: RBMQ_PROTOCOL,
    vhost: username === 'guest' ? '%2F' : RBMQ_VHOST
});


function verifyMessageSignature(message, publicKey, signature) {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(message, 'utf8');
    // verifier.end();
    const pubkeyPadding = {
        key: Buffer.from(publicKey),
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    }
    return verifier.verify(pubkeyPadding, signature, 'hex');
}


const connect = (username, password) => rbmqAccessLayer.connect(urlObj(username, password), sslOptions);
const disconnect = async () => {
    await mainChannelPromise.then(channel => channel.close());
    await secondaryChannelPromise.then(channel => channel.close());
}


const createAccounts = () => rbmqAccessLayer.createUser(RBMQ_USERNAME, RBMQ_PASSWORD, ['administrator', 'management'])
    .then(() => rbmqAccessLayer.add_rbmq_user_vhost(RBMQ_USERNAME))
    .then(() => rbmqAccessLayer.createUser('anonymous', 'anonymous', [""]))
    .then(rv => logData.addLog('helyos_core', null, rv.logType, rv.message))
    .then(() => rbmqAccessLayer.add_rbmq_user_vhost('anonymous'))
    .then(rv => logData.addLog('helyos_core', null, rv.logType, rv.message))
    .then(() => rbmqAccessLayer.update_guest_account_permissions('anonymous'))
    .then(rv => logData.addLog('helyos_core', null, rv.logType, rv.message))
    .then(() => logData.addLog('helyos_core', null, 'warn', 'RabbitmMQ helyOS core accounts are set.'))
    .catch((error) => {
        logData.addLog('helyos_core', null, 'error', `RMBTMQ ERROR: ${error.message}`);
        console.error(error, "helyos_core user already created?");
    });


const connect_as_admin_and_create_accounts = () => rbmqAccessLayer.connect(urlObj(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD), sslOptions)
    .then(conn => {
        console.log("=========================");
        console.log("Creating account for helyos_core in the AMQP server\n", urlObj().hostname);
        console.log("=========================");
        logData.addLog('helyos_core', null, 'warn', 'Connected to AMQP, creating accounts...');
        return createAccounts();
    });


const connect_as_guest_and_create_admin = () => rbmqAccessLayer.connect(urlObj('guest', 'guest'), sslOptions)
    .then(conn => rbmqAccessLayer.guestCreate_RbmqAdmin(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD, ['administrator', 'management']))
    .then(rv => logData.addLog('helyos_core', null, rv.logType, rv.message))
    .then(conn => rbmqAccessLayer.guestAdd_RbmqAdminVhost(RBMQ_ADMIN_USERNAME))
    .then(rv => logData.addLog('helyos_core', null, rv.logType, rv.message))
    .catch(e => logData.addLog('helyos_core', null, 'error', e.message));




// Initialize a RabbitMQ client and create channel
let mainChannelPromise, secondaryChannelPromise;

function getMainChannel(options = {}) {
    if (mainChannelPromise && !options.connect) {
        return mainChannelPromise.then(ch => {
            if (options.subscribe) {
                ch = options.recoverCallback(ch);
            }
            return ch
        });

    } else {
        return connectAndOpenChannels(options).then(channels => channels[0]);
    }
}


function connectAndOpenChannels(options = {}) {
    console.log('connectAndOpenChannels', options)

    return rbmqAccessLayer.connect(urlObj(), sslOptions)
        .then(conn => {
            console.log("=========================");
            console.log("Connected to AMQP server\n", urlObj().hostname);
            console.log("=========================");
            logData.addLog('helyos_core', null, 'warn', 'Connected to AMQP server.');
            conn.on('error', (err) => {
                logData.addLog('helyos_core', null, 'warn', 'RabbitMQ connection interrupted. Recovering...');
                console.error("====================RABITMQ CONNECTION LOST =============");
                console.error(err);
                console.error("=========================================================");
                connectAndOpenChannels({ subscribe: true, connect: true, recoverCallback: options.recoverCallback });
            });

            mainChannelPromise = conn.createChannel()
                .then(ch => {
                    if (options.subscribe) {
                        ch = options.recoverCallback(ch);
                    }
                    return ch;
                });


            secondaryChannelPromise = conn.createChannel()
                .then(ch => {
                    if (options.subscribe) {
                        ch = options.recoverCallback(ch);
                    }
                    return ch;
                });

            return Promise.all([mainChannelPromise, secondaryChannelPromise]);
        })
        .catch(e => {
            console.warn("\nWaiting AMQP server...\n\n");
            const promiseSetTimeout = util.promisify(setTimeout);
            return promiseSetTimeout(3000).then(() => connectAndOpenChannels({ subscribe: false, connect: true }))
        });
}


function sendEncryptedMsg(queue, message, publicKey = '', routingKey = null, exchange = null, correlationId = null) {
    let encryptedMsg;
    switch (ENCRYPT) {
        case "agent":
            encryptedMsg = crypto.publicEncrypt(
                {
                    key: publicKey,
                    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                },
                Buffer.from(message)
            );

            break;

        case "helyos":
            encryptedMsg = TODO_FUNCTION(HELYOS_SYM_KEY, message);

            break;

        case "helyos-agent":
            encryptedMsg = TODO_FUNCTION(AGENT_SYM_KEY, message);
            encryptedMsg = TODO_FUNCTION(HELYOS_SYM_KEY, encryptedMsg);

            break;

        case "none":
            encryptedMsg = message;
            break;

        default:
            encryptedMsg = message;
            break;
    }


    return getMainChannel()
        .then(dataChannel => {
            const sign = crypto.createSign('SHA256');
            sign.update(encryptedMsg);
            sign.end();
            const signature = sign.sign({
                key: HELYOS_PRIVATE_KEY,
                padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN,
            });
            const stringified = JSON.stringify({ message: encryptedMsg, signature: signature.toString('hex') });
            if (exchange == null) {
                exchange = AGENTS_DL_EXCHANGE;
            }
            if (queue) {
                dataChannel.sendToQueue(queue, Buffer.from(stringified), {
                    correlationId,
                    userId: RBMQ_USERNAME,
                    timestamp: Date.now()
                });
            }
            if (routingKey) {
                dataChannel.publish(exchange, routingKey, Buffer.from(stringified), {
                    correlationId,
                    userId: RBMQ_USERNAME,
                    timestamp: Date.now()
                });
            }
        });
}


function createDebugQueues(agent) {
    getMainChannel({ subscribe: false, connect: false }).then(dataChannel => {
        dataChannel.assertQueue(`tap-${agent.name}`, { durable: false, maxLength: 10 });
        dataChannel.bindQueue(`tap-${agent.name}`, AGENTS_DL_EXCHANGE, `*.${agent.uuid}.*`);
        dataChannel.bindQueue(`tap-${agent.name}`, AGENTS_UL_EXCHANGE, `*.${agent.uuid}.*`);
        dataChannel.bindQueue(`tap-${agent.name}`, AGENT_MQTT_EXCHANGE, `*.${agent.uuid}.*`);

        dataChannel.assertQueue(`tap-cmd_to_${agent.name}`, { durable: false, maxLength: 10 });
        dataChannel.bindQueue(`tap-cmd_to_${agent.name}`, AGENT_MQTT_EXCHANGE, `*.${agent.uuid}.assignment`);
        dataChannel.bindQueue(`tap-cmd_to_${agent.name}`, AGENTS_DL_EXCHANGE, `*.${agent.uuid}.assignment`);
        dataChannel.bindQueue(`tap-cmd_to_${agent.name}`, AGENT_MQTT_EXCHANGE, `*.${agent.uuid}.instantActions`);
        dataChannel.bindQueue(`tap-cmd_to_${agent.name}`, AGENTS_DL_EXCHANGE, `*.${agent.uuid}.instantActions`);
    });
}


async function assertOrSubstituteQueue(channel, queueName, exclusive, durable, arguments) {
    try {
        const queueInfo = await rbmqAccessLayer.getQueueInfo(queueName);
        const ttl = parseInt(queueInfo.arguments['x-message-ttl']);

        if (arguments && arguments['x-message-ttl'] && ttl !== arguments['x-message-ttl']) {
            console.log(`${queueName} queue TTL will be altered from ${ttl} to ${arguments['x-message-ttl']}.`);
            await channel.deleteQueue(queueName).catch(e => console.log(e));
            console.log(`Queue ${queueName} deleted.`);
            logData.addLog('helyos_core', null, 'warn', `Queue ${queueName} message-time-to-live was changed to ${arguments['x-message-ttl']}.`);
        }

        await channel.assertQueue(queueName, { exclusive: exclusive, durable: durable, arguments: arguments });
        logData.addLog('helyos_core', null, 'info', `Queue ${queueName} was asserted.`);
        return true;

    } catch (error) {
        console.log(`Queue ${queueName} not found. Creating...`);
        await channel.assertQueue(queueName, { exclusive: exclusive, durable: durable, arguments: arguments });
        logData.addLog('helyos_core', null, 'info', `Queue ${queueName} was created.`);
        return false;

    }
}


function removeDebugQueues(agent) {
    getMainChannel({ subscribe: false, connect: false }).then(dataChannel => {
        dataChannel.deleteQueue(`tap-${agent.name}`);
        dataChannel.deleteQueue(`tap-cmd_to_${agent.name}`);
    });
}




module.exports.connect = connect;
module.exports.disconnect = disconnect;

module.exports.connectAndOpenChannels = connectAndOpenChannels;
module.exports.sendEncryptedMsg = sendEncryptedMsg;
module.exports.create_rbmq_user = rbmqAccessLayer.createUser;
module.exports.remove_rbmq_user = rbmqAccessLayer.removeUser;
module.exports.add_rbmq_user_vhost = rbmqAccessLayer.add_rbmq_user_vhost;
module.exports.deleteConnections = rbmqAccessLayer.deleteConnections;

module.exports.connect_as_admin_and_create_accounts = connect_as_admin_and_create_accounts;
module.exports.connect_as_guest_and_create_admin = connect_as_guest_and_create_admin;
module.exports.createDebugQueues = createDebugQueues;
module.exports.removeDebugQueues = removeDebugQueues;
module.exports.assertOrSubstituteQueue = assertOrSubstituteQueue;
module.exports.getQueueInfo = rbmqAccessLayer.getQueueInfo;


module.exports.CHECK_IN_QUEUE = CHECK_IN_QUEUE;
module.exports.AGENT_UPDATE_QUEUE = AGENT_UPDATE_QUEUE;
module.exports.AGENT_VISUALIZATION_QUEUE = AGENT_VISUALIZATION_QUEUE;

module.exports.AGENT_STATE_QUEUE = AGENT_STATE_QUEUE;
module.exports.AGENT_MISSION_QUEUE = AGENT_MISSION_QUEUE;
module.exports.SUMMARY_REQUESTS_QUEUE = SUMMARY_REQUESTS_QUEUE;
module.exports.YARD_VISUALIZATION_QUEUE = YARD_VISUALIZATION_QUEUE;


module.exports.AGENTS_UL_EXCHANGE = AGENTS_UL_EXCHANGE;
module.exports.AGENTS_DL_EXCHANGE = AGENTS_DL_EXCHANGE;
module.exports.ANONYMOUS_EXCHANGE = ANONYMOUS_EXCHANGE;
module.exports.AGENT_MQTT_EXCHANGE = AGENT_MQTT_EXCHANGE;
module.exports.RBMQ_VHOST = RBMQ_VHOST;
module.exports.RBMQ_CERTIFICATE = RBMQ_CERTIFICATE;


module.exports.ANY_AGENT_RBMQ_USERNAME = ANY_AGENT_RBMQ_USERNAME;
module.exports.ANY_AGENT_RBMQ_PASSWORD = ANY_AGENT_RBMQ_PASSWORD;
module.exports.MESSAGE_VERSION = MESSAGE_VERSION;
module.exports.verifyMessageSignature = verifyMessageSignature;
