// Services imports

const rabbitMQServices = require('../../services/message_broker/rabbitMQ_services.js');
const databaseServices = require('../../services/database/database_services.js');
const memDBService = require('../../services/in_mem_database/mem_database_service');
const { RBMQ_CERTIFICATE } = require('../../config.js');

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { logData } = require('../../modules/systemlog.js');
const { AGENT_STATUS } = require('../../modules/data_models.js');

let HELYOS_PUBLIC_KEY = '', HELYOS_PRIVATE_KEY = '';
try {
     HELYOS_PRIVATE_KEY = fs.readFileSync('/etc/helyos/.ssl_keys/helyos_private.key');
     HELYOS_PUBLIC_KEY = fs.readFileSync('/etc/helyos/.ssl_keys/helyos_public.key',{encoding:'utf8'});
} catch (error) {
    console.warn('Private and/or public key not defined');
}


const MESSAGE_VERSION = rabbitMQServices.MESSAGE_VERSION;


function agentCheckOut(uuid, data, msgProps, registeredAgent, replyExchange) {
    return processAgentCheckOut(uuid, data, msgProps, registeredAgent)
        .then(agent => {
            let replyTo = msgProps.replyTo?  msgProps.replyTo : agent.message_channel;
            if (replyTo) replyTo = replyTo.replace(/\//g,'.');

            try {
                    const message = JSON.stringify({
                        type: 'checkout',
                        uuid: agent.uuid,
                        body: {
                            agentId: agent.id,
                            yard_uid: null,
                            message: "check-out successful",
                            response_code: '200'
                        },
                        _version: MESSAGE_VERSION,

                    });
                    console.log("================== checkout response message to =======================");
                    console.log(`${uuid} => ${agent.uuid}`);
                    console.log("======================================================================");
                    const public_key = agent['public_key'] || (registeredAgent && registeredAgent.public_key) ;
                    rabbitMQServices.sendEncryptedMsg(replyTo, message, public_key);
                    rabbitMQServices.sendEncryptedMsg(null, message, public_key, replyTo, replyExchange);
                    return agent;   

            } catch (error) {
    
                const message = JSON.stringify({
                    type: 'checkout',
                    uuid: uuid,
                    body: {
                        message: 'internal error',
                        response_code: '500'
                    }
                });
                rabbitMQServices.sendEncryptedMsg(replyTo, message);
                rabbitMQServices.sendEncryptedMsg(null, message, agent.public_key, replyTo, replyExchange);
                throw Error(err);
            };
        })


        .catch(err => {
                console.log(err);
                const message = JSON.stringify({
                    type: 'checkin',
                    body: {
                        message: err.message,
                        response_code: err.code
                    },
                    _version: MESSAGE_VERSION

                });
                const replyToQueue = msgProps.replyTo || uuid;
                rabbitMQServices.sendEncryptedMsg(replyToQueue, message);
                throw err;

        });
}




const encryptPassword = (passwd, pubkey) => passwd;

const createAgentRbmqAccount = (agentIdentification={id:'', uuid:''}, username='', password='') => {
    return databaseServices.agents.select(agentIdentification)
    .then( r => {
        const agent = r[0];
        const _password = password? password: uuidv4();
        let _username = username? username: agent.uuid;
        _username = agent.rbmq_username?  agent.rbmq_username: _username;

        return rabbitMQServices.create_rbmq_user(_username, _password, [])
                .then(() => rabbitMQServices.add_rbmq_user_vhost(_username))
                .then(() => {
                    rabbitMQServices.createDebugQueues(agent);
                    const hashPassword = encryptPassword(_password, agent.pubkey);
                    return {
                            id: agent.id,
                            uuid: agent.uuid,
                            rbmq_username: _username,
                            rbmq_encrypted_password: hashPassword,
                            has_rbmq_account: true
                        };

                });
    });
}

const removeAgentRbmqAccount = (agentData) => {
        return rabbitMQServices.remove_rbmq_user(agentData.rbmq_username)
        .then(() => {
            rabbitMQServices.removeDebugQueues(agentData);
            return 0
        });
}


async function processAgentCheckOut(uuid, data, msgProps, registeredAgent) {

    // 1 - PARSE INPUT

    // 2 - VALIDATIONS
    const agentStatus =  await databaseServices.agents.get('uuid', uuid, ['status'])[0]?.status;
    if ([AGENT_STATUS.BUSY, AGENT_STATUS.READY].includes(agentStatus) ) {
        throw Error(`Agent ${uuid} cannot check out. Status ${agentStatus}.`);
    }

    // 3- CHECK-OUT
    let agentUpdate = {uuid: uuid, yard_id: null};
    agentUpdate['last_message_time'] = new Date();

    const inMemDB =  await memDBService.getInstance();
    inMemDB.update('agents','uuid', agentUpdate, agentUpdate.last_message_time,'buffered');
    inMemDB.countMessages('agents_stats', uuid, 'updtPerSecond');
    return databaseServices.agents.updateByConditions({uuid}, agentUpdate)
           .then(() => databaseServices.agents.get('uuid', uuid, [ 'id', 'uuid',
                                                                 'message_channel', 
                                                                 'rbmq_username',
                                                                 'rbmq_encrypted_password',
                                                                 'yard_id',
                                                                 'public_key'
                                                                ]))
            .then(agents=>agents[0])
}


module.exports.agentCheckOut = agentCheckOut;
module.exports.createAgentRbmqAccount = createAgentRbmqAccount;
module.exports.removeAgentRbmqAccount = removeAgentRbmqAccount;


