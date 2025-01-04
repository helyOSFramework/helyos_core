import config from '../../config.js';
import { logData } from '../../modules/systemlog.js';
import crypto from 'crypto';
import fs from 'fs';
import util from 'util';
import rbmqAccessLayer from './rabbitMQ_access_layer';

const MESSAGE_VERSION = '2.0.0';

const {
    RBMQ_HOST,
    RBMQ_PORT,
    RBMQ_PROTOCOL,
    RBMQ_SSL,
    RBMQ_USERNAME,
    RBMQ_PASSWORD,
    RBMQ_CNAME,
    RBMQ_ADMIN_USERNAME,
    RBMQ_ADMIN_PASSWORD,
    RBMQ_VHOST,
    RBMQ_CERTIFICATE,
    ANONYMOUS_EXCHANGE,
} = config;

const {
    CHECK_IN_QUEUE,
    AGENT_UPDATE_QUEUE,
    AGENT_VISUALIZATION_QUEUE,
    YARD_VISUALIZATION_QUEUE,
    AGENT_STATE_QUEUE,
    AGENT_MISSION_QUEUE,
    SUMMARY_REQUESTS_QUEUE,
    AGENTS_UL_EXCHANGE,
    AGENTS_DL_EXCHANGE,
    AGENTS_MQTT_EXCHANGE,
    ENCRYPT,
} = config;

const sslOptions = RBMQ_SSL
    ? {
            ca: [RBMQ_CERTIFICATE],
            servername: RBMQ_CNAME,
        }
    : {};

let HELYOS_PUBLIC_KEY: Buffer | string = '';
let HELYOS_PRIVATE_KEY:  Buffer | string = '';
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
    vhost: username === 'guest' ? '%2F' : RBMQ_VHOST,
});

function verifyMessageSignature(message: string, publicKey: string, signature: string): boolean {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(message, 'utf8');
    const pubkeyPadding = {
        key: Buffer.from(publicKey),
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    };
    return verifier.verify(pubkeyPadding, signature, 'hex');
}

const connect = (username: string, password: string) => rbmqAccessLayer.connect(urlObj(username, password) as any, sslOptions);
const disconnect = async () => {
    await mainChannelPromise.then((channel) => channel.close());
    await secondaryChannelPromise.then((channel) => channel.close());
};

const createAccounts = () =>
    rbmqAccessLayer
        .createUser(RBMQ_USERNAME, RBMQ_PASSWORD, ['administrator', 'management'])
        .then(() => rbmqAccessLayer.addRbmqUserVhost(RBMQ_USERNAME))
        .then(() => rbmqAccessLayer.createUser('anonymous', 'anonymous', ['']))
        .then((rv) => logData.addLog('helyos_core', null, rv?.logType, rv?.message))
        .then(() => rbmqAccessLayer.addRbmqUserVhost('anonymous'))
        .then((rv) => logData.addLog('helyos_core', null, rv?.logType, rv?.message))
        .then(() => rbmqAccessLayer.updateGuestAccountPermissions('anonymous'))
        .then((rv) => logData.addLog('helyos_core', null, rv?.logType, rv?.message))
        .then(() => logData.addLog('helyos_core', null, 'warn', 'RabbitmMQ helyOS core accounts are set.'))
        .catch((error) => {
            logData.addLog('helyos_core', null, 'error', `RMBTMQ ERROR: ${error.message}`);
            console.error(error, 'helyos_core user already created?');
        });

const connect_as_admin_and_create_accounts = () =>
    rbmqAccessLayer
        .connect(urlObj(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD) as any, sslOptions)
        .then((conn) => {
            console.log('=========================');
            console.log('Creating account for helyos_core in the AMQP server\n', urlObj().hostname);
            console.log('=========================');
            logData.addLog('helyos_core', null, 'warn', 'Connected to AMQP, creating accounts...');
            return createAccounts();
        });

const connect_as_guest_and_create_admin = () =>
    rbmqAccessLayer
        .connect(urlObj('guest', 'guest') as any, sslOptions)
        .then((conn) => rbmqAccessLayer.guestCreate_RbmqAdmin(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD, ['administrator', 'management']))
        .then((rv) => logData.addLog('helyos_core', null, rv.logType, rv.message))
        .then((conn) => rbmqAccessLayer.guestAdd_RbmqAdminVhost(RBMQ_ADMIN_USERNAME))
        .then((rv) => logData.addLog('helyos_core', null, rv.logType, rv.message))
        .catch((e) => logData.addLog('helyos_core', null, 'error', e.message));

let mainChannelPromise: Promise<any>, secondaryChannelPromise: Promise<any>;

function getMainChannel(options: any = {}) {
    if (mainChannelPromise && !options.connect) {
        return mainChannelPromise.then((ch) => {
            if (options.subscribe) {
                ch = options.recoverCallback(ch);
            }
            return ch;
        });
    } else {
        return connectAndOpenChannels(options).then((channels) => channels[0]);
    }
}

function connectAndOpenChannels(options:any = {}) {
    console.log('connectAndOpenChannels', options);

    return rbmqAccessLayer
        .connect(urlObj() as any, sslOptions)
        .then((conn) => {
            console.log('=========================');
            console.log('Connected to AMQP server\n', urlObj().hostname);
            console.log('=========================');
            logData.addLog('helyos_core', null, 'warn', 'Connected to AMQP server.');
            conn.on('error', (err) => {
                logData.addLog('helyos_core', null, 'warn', 'RabbitMQ connection interrupted. Recovering...');
                console.error('====================RABITMQ CONNECTION LOST =============');
                console.error(err);
                console.error('=========================================================');
                connectAndOpenChannels({ subscribe: true, connect: true, recoverCallback: options.recoverCallback });
            });

            mainChannelPromise = conn
                .createChannel()
                .then((ch) => {
                    if (options.subscribe) {
                        ch = options.recoverCallback(ch);
                    }
                    return ch;
                });

            secondaryChannelPromise = conn
                .createChannel()
                .then((ch) => {
                    if (options.subscribe) {
                        ch = options.recoverCallback(ch);
                    }
                    return ch;
                });

            return Promise.all([mainChannelPromise, secondaryChannelPromise]);
        })
        .catch((e) => {
            console.warn('\nWaiting AMQP server...\n\n');
            const promiseSetTimeout = util.promisify(setTimeout);
            return promiseSetTimeout(3000).then(() => connectAndOpenChannels({ subscribe: false, connect: true }));
        });
}

function sendEncryptedMsg(queue: string, message: string, publicKey = '',
                          routingKey:string = '', exchange:string = '', correlationId = null) {
    const _message = message === undefined ? '' : message;
    let encryptedMsg;
    switch (ENCRYPT) {
        case 'agent':
            encryptedMsg = crypto.publicEncrypt(
                {
                    key: publicKey,
                    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                },
                Buffer.from(_message)
            );
            break;

        case 'helyos':
            // encryptedMsg = TODO_FUNCTION(HELYOS_SYM_KEY, _message);
            break;

        case 'helyos-agent':
            // encryptedMsg = TODO_FUNCTION(AGENT_SYM_KEY, _message);
            // encryptedMsg = TODO_FUNCTION(HELYOS_SYM_KEY, encryptedMsg);
            break;

        case 'none':
            encryptedMsg = _message;
            break;

        default:
            encryptedMsg = _message;
            break;
    }

    return getMainChannel()
        .then((dataChannel) => {
            const sign = crypto.createSign('SHA256');
            sign.update(encryptedMsg);
            sign.end();
            const signature = sign.sign({
                key: HELYOS_PRIVATE_KEY,
                padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN,
            });
            const stringified = JSON.stringify({ message: encryptedMsg, signature: signature.toString('hex') });
            if (exchange == '') {
                exchange = AGENTS_DL_EXCHANGE;
            }
            if (queue) {
                dataChannel.sendToQueue(queue, Buffer.from(stringified), {
                    correlationId,
                    userId: RBMQ_USERNAME,
                    timestamp: Date.now(),
                });
            }
            if (routingKey) {
                dataChannel.publish(exchange, routingKey, Buffer.from(stringified), {
                    correlationId,
                    userId: RBMQ_USERNAME,
                    timestamp: Date.now(),
                });
            }
        })
        .catch((error) => {
            logData.addLog('helyos', {}, 'error', `Error sending message to ${routingKey || queue}: ${error.message}`);
        });
}

function createDebugQueues(agent: any) {
    getMainChannel({ subscribe: false, connect: false }).then((dataChannel) => {
        dataChannel.assertQueue(`tap-${agent.name}`, { durable: false, maxLength: 10 });
        dataChannel.bindQueue(`tap-${agent.name}`, AGENTS_DL_EXCHANGE, `*.${agent.uuid}.*`);
        dataChannel.bindQueue(`tap-${agent.name}`, AGENTS_UL_EXCHANGE, `*.${agent.uuid}.*`);
        dataChannel.bindQueue(`tap-${agent.name}`, AGENTS_MQTT_EXCHANGE, `*.${agent.uuid}.*`);

        dataChannel.assertQueue(`tap-cmd_to_${agent.name}`, { durable: false, maxLength: 10 });
        dataChannel.bindQueue(`tap-cmd_to_${agent.name}`, AGENTS_MQTT_EXCHANGE, `*.${agent.uuid}.assignment`);
        dataChannel.bindQueue(`tap-cmd_to_${agent.name}`, AGENTS_DL_EXCHANGE, `*.${agent.uuid}.assignment`);
        dataChannel.bindQueue(`tap-cmd_to_${agent.name}`, AGENTS_MQTT_EXCHANGE, `*.${agent.uuid}.instantActions`);
        dataChannel.bindQueue(`tap-cmd_to_${agent.name}`, AGENTS_DL_EXCHANGE, `*.${agent.uuid}.instantActions`);
    });
}

async function assertOrSubstituteQueue(channel: any, queueName: string, exclusive: boolean, durable: boolean, args: any) {
    try {
        const queueInfo = await rbmqAccessLayer.getQueueInfo(queueName);
        const ttl = parseInt(queueInfo.arguments['x-message-ttl']);

        if (arguments && arguments['x-message-ttl'] && ttl !== args['x-message-ttl']) {
            console.log(`${queueName} queue TTL will be altered from ${ttl} to ${args['x-message-ttl']}.`);
            await channel.deleteQueue(queueName).catch((e) => console.log(e));
            console.log(`Queue ${queueName} deleted.`);
            logData.addLog('helyos_core', null, 'warn', `Queue ${queueName} message-time-to-live was changed to ${args['x-message-ttl']}.`);
        }

        await channel.assertQueue(queueName, { exclusive: exclusive, durable: durable, arguments: args });
        logData.addLog('helyos_core', null, 'info', `Queue ${queueName} was asserted.`);
        return true;
    } catch (error) {
        console.log(`Queue ${queueName} not found. Creating...`);
        await channel.assertQueue(queueName, { exclusive: exclusive, durable: durable, arguments: args });
        logData.addLog('helyos_core', null, 'info', `Queue ${queueName} was created.`);
        return false;
    }
}

function removeDebugQueues(agent: any) {
    getMainChannel({ subscribe: false, connect: false }).then((dataChannel) => {
        dataChannel.deleteQueue(`tap-${agent.name}`);
        dataChannel.deleteQueue(`tap-cmd_to_${agent.name}`);
    });
}


const create_rbmq_user = rbmqAccessLayer.createUser;
const remove_rbmq_user = rbmqAccessLayer.removeUser;
const deleteConnections = rbmqAccessLayer.deleteConnections;
const add_rbmq_user_vhost = rbmqAccessLayer.addRbmqUserVhost;
const getQueueInfo = rbmqAccessLayer.getQueueInfo;

export default {
    create_rbmq_user,
    remove_rbmq_user,
    add_rbmq_user_vhost,
    deleteConnections,
    getQueueInfo,

    connect,
    disconnect,
    connectAndOpenChannels,
    sendEncryptedMsg,
    connect_as_admin_and_create_accounts,
    connect_as_guest_and_create_admin,
    createDebugQueues,
    removeDebugQueues,
    assertOrSubstituteQueue,
    CHECK_IN_QUEUE,
    AGENT_UPDATE_QUEUE,
    AGENT_VISUALIZATION_QUEUE,
    AGENT_STATE_QUEUE,
    AGENT_MISSION_QUEUE,
    SUMMARY_REQUESTS_QUEUE,
    YARD_VISUALIZATION_QUEUE,
    AGENTS_UL_EXCHANGE,
    AGENTS_DL_EXCHANGE,
    ANONYMOUS_EXCHANGE,
    AGENTS_MQTT_EXCHANGE,
    RBMQ_VHOST,
    RBMQ_CERTIFICATE,
    MESSAGE_VERSION,
    verifyMessageSignature,
};
