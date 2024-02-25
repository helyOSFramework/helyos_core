
const {saveLogData} = require('../../modules/systemlog.js');
// ----------------------------------------------------------------------------
// RabbitMQ interface layer
// ----------------------------------------------------------------------------
const amqp = require('amqplib');
const fs = require('fs');
const requestXHTTP = require('superagent');

const RBMQ_HOST = process.env.RBMQ_HOST;
const RBMQ_API_PORT= process.env.RBMQ_API_PORT || 15672;
const RBMQ_CNAME = process.env.RBMQ_CNAME || RBMQ_HOST;
const RBMQ_ADMIN_USERNAME= process.env.RBMQ_ADMIN_USERNAME || 'guest';
const RBMQ_ADMIN_PASSWORD= process.env.RBMQ_ADMIN_PASSWORD || 'guest';

const RBMQ_SSL = (process.env.RBMQ_SSL || "False") === "True";
const RBMQ_API_SSL = (process.env.RBMQ_API_SSL || process.env.RBMQ_SSL || "False") === "True";

const TLS_REJECT_UNAUTHORIZED = (process.env.TLS_REJECT_UNAUTHORIZED || "True") === "True";
if (!TLS_REJECT_UNAUTHORIZED) {process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;}

const API_PROTOCOL = RBMQ_API_SSL? 'https':'http';
const RBMQ_CERTIFICATE = RBMQ_SSL? fs.readFileSync('/etc/helyos/.ssl_keys/ca_certificate.pem'):null;
const ANONYMOUS_EXCHANGE = process.env.ANONYMOUS_EXCHANGE || 'xchange_helyos.agents.anonymous';


const create_rbmq_admin = (username, password, tags) => 
        requestXHTTP
        .put(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/users/${username}`)
        .send({'username': username,  'password':password ,tags: tags})
        .set( {'content-type': 'application/json'  }).ca(RBMQ_CERTIFICATE)
        .auth('guest', 'guest')
        .then(() => requestXHTTP
                    .put(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/permissions/%2F/${username}`)
                    .send({"configure":".*","write":".*","read":".*"})
                    .set( {'content-type': 'application/json'  }).ca(RBMQ_CERTIFICATE)
                    .auth('guest', 'guest'))

        .catch((e)=>  {
            console.error(e);
            saveLogData('helyos_core', null, 'warn', `RabbitmMQ admin already created?/n${e.code}` );
        });
        

const createUser = (username, password, tags) =>  !username? Promise.resolve(null) :
        requestXHTTP
        .put(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/users/${username}`)
        .send({'username': username,  'password':password ,tags: tags})
        .set( {'content-type': 'application/json'  }).ca(RBMQ_CERTIFICATE)
        .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
        .catch( e => {  saveLogData('helyos_core', null, 'error', `CREATE ACCOUNT RMBTMQ: ${e}` );
                        throw e; 
        });
        
const removeUser = (username) =>  !username? Promise.resolve(null) :
        requestXHTTP    
        .delete(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/users/${username}`)
        .set( {'content-type': 'application/json'  }).ca(RBMQ_CERTIFICATE)
        .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
        .catch( e => {  saveLogData('helyos_core', null, 'error', `DELETE ACCOUNT RMBTMQ: ${e}` );
                        throw e;
        });


const add_rbmq_user_vhost = (username) =>  !username? Promise.resolve(null) :
        requestXHTTP
        .put(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/permissions/%2F/${username}`)
        .send({"configure":".*","write":".*","read":".*"})
        .set( {'content-type': 'application/json'  }).ca(RBMQ_CERTIFICATE)
        .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
        .catch( e => {  saveLogData('helyos_core', null, 'error', `VHOST PERMISSION: ${e}` );
                throw e; 
        });

const listConnections = (username) =>  !username? Promise.resolve(null) :
        requestXHTTP
        .get(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/connections/username/${username}`)
        .set( {'content-type': 'application/json'  }).ca(RBMQ_CERTIFICATE)
        .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
        .then(r => r.body)
        .catch( e => {  saveLogData('helyos_core', null, 'error', `VHOST PERMISSION: ${e}` );
                throw e; 
        });


const deleteConnections = (username) =>  {
                saveLogData('helyos_core', null, 'warn', `helyos remove agent connections: ${username}`);

                return !username? Promise.resolve(null) :
                requestXHTTP
                .delete(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/connections/username/${username}`)
                .set( {'content-type': 'application/json', 'X-Reason':'exceed update rate' }).ca(RBMQ_CERTIFICATE)
                .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
                .then(r => r.body)
                .catch( e => {  saveLogData('helyos_core', null, 'error', `RabbitMQ: ${e}` );
                        throw e; 
                });
        }


const guestPermissions = `(amq\.gen.*|${ANONYMOUS_EXCHANGE})`;
const update_guest_account_permissions = (username) => !username? Promise.resolve(null) :
        requestXHTTP
        .put(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/permissions/%2F/${username}`)
        .send({"configure":`^${guestPermissions}`,"write":guestPermissions,"read":guestPermissions})
        .set( {'content-type': 'application/json'  }).ca(RBMQ_CERTIFICATE)
        .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
        .catch( e => {  saveLogData('helyos_core', null, 'error', `SETTING ANONYMOUS PERMISSIONS: ${e}` );
        throw e; 
});


const connect = amqp.connect;
    

module.exports.update_guest_account_permissions = update_guest_account_permissions;
module.exports.createUser = createUser;
module.exports.removeUser = removeUser;
module.exports.create_rbmq_admin = create_rbmq_admin;
module.exports.add_rbmq_user_vhost = add_rbmq_user_vhost;
module.exports.listConnections = listConnections;
module.exports.deleteConnections = deleteConnections;
module.exports.connect = connect;




