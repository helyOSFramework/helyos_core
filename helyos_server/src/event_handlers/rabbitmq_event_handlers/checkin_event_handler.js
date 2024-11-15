// Services imports

const rabbitMQServices = require('../../services/message_broker/rabbitMQ_services.js');
const databaseServices = require('../../services/database/database_services.js');
const memDBService = require('../../services/in_mem_database/mem_database_service');

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { logData } = require('../../modules/systemlog.js');
const { AGENT_STATUS } = require('../../modules/data_models.js');
const RBMQ_SSL = (process.env.RBMQ_SSL || "False") === "True";
const RBMQ_CERTIFICATE = RBMQ_SSL? fs.readFileSync('/etc/helyos/.ssl_keys/ca_certificate.pem', 'utf-8'):null;
let HELYOS_PUBLIC_KEY = '', HELYOS_PRIVATE_KEY = '';
try {
     HELYOS_PRIVATE_KEY = fs.readFileSync('/etc/helyos/.ssl_keys/helyos_private.key');
     HELYOS_PUBLIC_KEY = fs.readFileSync('/etc/helyos/.ssl_keys/helyos_public.key',{encoding:'utf8'});
} catch (error) {
    console.warn('Private and/or public key not defined');
}

// Helpers
const MESSAGE_VERSION = rabbitMQServices.MESSAGE_VERSION;
const isYardUIdRegistered = (uid) => databaseServices.yards.get('uid', uid, ['id']).then(r => (r && r.length)? r[0].id : 0);

function agentCheckIn(uuid, data, msgProps, registeredAgent, replyExchange) {
    return processAgentCheckIn(uuid, data, msgProps, registeredAgent)
        .then(agent => {
            let replyTo = msgProps.replyTo?  msgProps.replyTo : agent.message_channel;
            if (replyTo) replyTo = replyTo.replace(/\//g,'.');

            return databaseServices.yards.get_byId(agent.yard_id, ['id', 'lat', 'lon', 'alt', 'map_data'])
            .then(yard => {
                    return  databaseServices.map_objects.get('yard_id', yard.id)
                    .then(map_objects => {
                            const _map_objects = map_objects.map(s => ({
                                type: s.type,
                                metadata: s.metadata,
                                data: s.data
                            }));
                            const message = JSON.stringify({
                                type: 'checkin',
                                uuid: agent.uuid,
                                body: {
                                    agentId: agent.id,
                                    yard_uid: yard.uid,
                                    map: {origin: {lat: yard.lat, lon: yard.lon, alt: yard.alt},
                                        map_objects: _map_objects,
                                        id: yard.id,
                                        uid: yard.uid
                                        },
                                    message: "check-in successful",
                                    rbmq_username: agent.rbmq_username,
                                    rbmq_encrypted_password: agent.rbmq_encrypted_password,
                                    rbmq_password: agent.rbmq_encrypted_password,
                                    ca_certificate: RBMQ_CERTIFICATE,
                                    helyos_public_key: HELYOS_PUBLIC_KEY,
                                    password_encrypted: false,
                                    response_code: '200'
                                },
                                _version: MESSAGE_VERSION,

                            });
                            console.log("================== checkin response message to =======================");
                            console.log(`${uuid} => ${agent.uuid}`);
                            console.log("======================================================================");
                            const public_key = agent['public_key'] || (registeredAgent && registeredAgent.public_key) ;
                            rabbitMQServices.sendEncryptedMsg(replyTo, message, public_key);
                            rabbitMQServices.sendEncryptedMsg(null, message, public_key, replyTo, replyExchange);    
                    })
                    .catch(err => {
                        const message = JSON.stringify({
                            type: 'checkin',
                            uuid: uuid,
                            body: {
                                message: 'internal error',
                                response_code: '500'
                            }
                        });
                        rabbitMQServices.sendEncryptedMsg(replyTo, message);
                        rabbitMQServices.sendEncryptedMsg(null, message, agent.public_key, replyTo, replyExchange);
                        throw Error(err);
                    });
            })
            .catch(err => {
                const message = JSON.stringify({
                    type: 'checkin',
                    uuid: uuid,
                    body: {
                        message: 'internal error',
                        response_code: '500'
                    }
                });
                rabbitMQServices.sendEncryptedMsg(replyTo, message);
                rabbitMQServices.sendEncryptedMsg(null, message, agent.public_key, replyTo, replyExchange);
                console.error('Stack trace:', err.stack);
                throw Error(err);
            });
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


async function processAgentCheckIn(uuid, data, msgProps, registeredAgent) {

    // 1 - PARSE INPUT
    let checkinData = data.body? data.body : data; // compatibility for agent versions < 2.0
    const checkingYard = checkinData.yard_id || checkinData.yard_uid // compatibility for agent versions < 2.0
    let replyTo = data.replyTo;
    const isAnonymous = msgProps['userId'] == 'anonymous';

    // 2 - VALIDATIONS
    if (!registeredAgent) {
        await databaseServices.agents.insert({uuid:uuid, name: 'agent-', connection_status: 'online' })
        .then(agentId => databaseServices.agents.update_byId(agentId, {name: `agent-${agentId}`, code:`agent-${agentId}`}));
    }

    if (!checkingYard){
        logData.addLog('agent', {uuid}, 'error', `agent failed to check in; yard uid is missing`);
        throw ({msg:`agent failed to check in; yard uid is missing;']}`, code: 'YARD-400'});
    }
    const yardId = await isYardUIdRegistered(checkingYard.toString());
    if (!yardId) {
        console.log("=========================================")
        console.log("Yard was not registered;");
        console.log("=========================================")
        throw ({msg:`Yard was not registered; ${checkinData['yard_uid']}`, code: 'YARD-404'});
    }


    // 3- CHECK-IN 
    let agentUpdate = {uuid: uuid};
    agentUpdate['last_message_time'] = new Date();
   
    if (isAnonymous) {
        const credentials = await createAgentRbmqAccount({'uuid':uuid});
        agentUpdate['id'] = credentials.id;
        agentUpdate['rbmq_username'] = credentials.rbmq_username;
        agentUpdate['rbmq_encrypted_password'] = credentials.rbmq_encrypted_password;
        agentUpdate['has_rbmq_account'] = credentials.has_rbmq_account;
    } 

    agentUpdate['yard_id'] = yardId;
    agentUpdate['status'] = data['status'] || checkinData['status'] || AGENT_STATUS.FREE;
    agentUpdate['message_channel'] = replyTo || uuid;

    if ('public_key' in checkinData){
        logData.addLog('agent', {uuid}, 'info', `agent public key updated`);
        agentUpdate['public_key'] = checkinData.public_key;
    }

    // Backward compatibility:  agent versions < 1.5
    if (checkinData.name || checkinData.plate) { 
        agentUpdate['name'] = checkinData.name; 
        agentUpdate['code'] = checkinData.name; 
    }
    //

    if ('pose' in checkinData) {
        agentUpdate['x'] = checkinData['pose']['x'];
        agentUpdate['y'] = checkinData['pose']['y'];
        agentUpdate['z'] = checkinData['pose']['z'];
        agentUpdate['orientations'] = [0]

        if (checkinData['pose']['orientations'] && checkinData['pose']['orientations'].length > 0) {
            agentUpdate['orientation'] = checkinData['pose']['orientations'][0];
            agentUpdate['orientations'] = checkinData['pose']['orientations'];
        }  
    }

    let vehicleGeometry, factSheet;
    
    if ('agent_type' in checkinData) {
        agentUpdate['agent_type'] = checkinData['agent_type'];
    }

    if ('data_format' in checkinData) {
        agentUpdate['data_format'] = checkinData['data_format'];
    }


    if ('factsheet' in checkinData){
        agentUpdate['factsheet'] =  checkinData['factsheet'];
    } 
    
    if ('geometry' in checkinData) {
        agentUpdate['geometry'] =  checkinData['geometry'];  
    }


    const inMemDB =  await memDBService.getInstance();
    inMemDB.update('agents','uuid', agentUpdate, agentUpdate.last_message_time,'buffered');
    inMemDB.agents_stats[uuid]['updtPerSecond'].countMessage();
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


module.exports.agentCheckIn = agentCheckIn;
module.exports.createAgentRbmqAccount = createAgentRbmqAccount;
module.exports.removeAgentRbmqAccount = removeAgentRbmqAccount;


