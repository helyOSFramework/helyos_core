
// ----------------------------------------------------------------------------
// RabbitMQ interface layer
// ----------------------------------------------------------------------------
const amqp = require('amqplib');
const fs = require('fs');
const requestXHTTP = require('superagent');

const RBMQ_HOST = process.env.RBMQ_HOST;
const RBMQ_API_PORT = process.env.RBMQ_API_PORT || 15672;
const RBMQ_CNAME = process.env.RBMQ_CNAME || RBMQ_HOST;
const RBMQ_ADMIN_USERNAME = process.env.RBMQ_ADMIN_USERNAME || 'guest';
const RBMQ_ADMIN_PASSWORD = process.env.RBMQ_ADMIN_PASSWORD || 'guest';
const RBMQ_VHOST = process.env.RBMQ_VHOST || '%2F';

const RBMQ_SSL = (process.env.RBMQ_SSL || "False") === "True";
const RBMQ_API_SSL = (process.env.RBMQ_API_SSL || process.env.RBMQ_SSL || "False") === "True";

const TLS_REJECT_UNAUTHORIZED = (process.env.TLS_REJECT_UNAUTHORIZED || "True") === "True";
if (!TLS_REJECT_UNAUTHORIZED) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0; }

const API_PROTOCOL = RBMQ_API_SSL ? 'https' : 'http';
const RBMQ_CERTIFICATE = RBMQ_SSL ? fs.readFileSync('/etc/helyos/.ssl_keys/ca_certificate.pem') : null;
const ANONYMOUS_EXCHANGE = process.env.ANONYMOUS_EXCHANGE || 'xchange_helyos.agents.anonymous';


const guestCreate_RbmqAdmin = (username, password, tags) =>
        requestXHTTP
                .put(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/users/${username}`)
                .send({ 'username': username, 'password': password, tags: tags })
                .set({ 'content-type': 'application/json' }).ca(RBMQ_CERTIFICATE)
                .auth('guest', 'guest')
                .then(() => ({ logType: 'info', message: `RabbitMQ admin created for ${username}` }))
                .catch((e) => {
                        throw new Error(`Error in creating RabbitMQ admin account for ${username}: ${e.response?.body?.reason}`);
                });

const guestAdd_RbmqAdminVhost = (username) => !username ? Promise.resolve(null) :
        requestXHTTP
                .put(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/permissions/${RBMQ_VHOST}/${username}`)
                .send({ "configure": ".*", "write": ".*", "read": ".*" })
                .set({ 'content-type': 'application/json' }).ca(RBMQ_CERTIFICATE)
                .auth('guest', 'guest')
                .then(() => ({ logType: 'info', message: `Set ${username} permissions in RabbitMQ/${RBMQ_VHOST}` }))
                .catch(e => {
                        throw new Error(`VHOST PERMISSION: ${e.response?.body?.reason}`);
                });



const createUser = (username, password, tags) => !username ? Promise.resolve(null) :
        requestXHTTP
                .put(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/users/${username}`)
                .send({ 'username': username, 'password': password, tags: tags })
                .set({ 'content-type': 'application/json' }).ca(RBMQ_CERTIFICATE)
                .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
                .then(() => ({ logType: 'info', message: `RabbitMQ account created for ${username}` }))
                .catch(e => {
                        throw new Error(`Error in creating RabbitMQ account: ${e.response?.body?.reason}`);
                });

const removeUser = (username) => !username ? Promise.resolve(null) :
        requestXHTTP
                .delete(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/users/${username}`)
                .set({ 'content-type': 'application/json' }).ca(RBMQ_CERTIFICATE)
                .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
                .then(() => ({ logType: 'info', message: `RabbitMQ ${username} account deleted` }))
                .catch(e => {
                        throw new Error(`DELETE ACCOUNT RMBTMQ: ${e.response?.body?.reason}`);
                });

const add_rbmq_user_vhost = (username, 
                            permissions={"configure": '.*', "write": '.*', "read": '.*'}
                            ) => !username ? Promise.resolve(null) :
        requestXHTTP
                .put(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/permissions/${RBMQ_VHOST}/${username}`)
                .send({ "configure": permissions.configure, "write": permissions.write, "read": permissions.read })
                .set({ 'content-type': 'application/json' }).ca(RBMQ_CERTIFICATE)
                .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
                .then(() => ({ logType: 'info', message: `Set account permissions within RabbitMQ-vhost:${RBMQ_VHOST}` }))
                .catch(e => {
                        throw new Error(`VHOST PERMISSION: ${e.response?.body?.reason}`);
                });

const listConnections = (username) => !username ? Promise.resolve(null) :
        requestXHTTP
                .get(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/connections/username/${username}`)
                .set({ 'content-type': 'application/json' }).ca(RBMQ_CERTIFICATE)
                .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
                .then(r => r.body)
                .catch(e => {
                        throw new Error(`VHOST PERMISSION:${e.response?.body?.reason}`);
                });

const deleteConnections = (username) => {
        return !username ? Promise.resolve(null) :
                requestXHTTP
                        .delete(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/connections/username/${username}`)
                        .set({ 'content-type': 'application/json', 'X-Reason': 'exceed update rate' }).ca(RBMQ_CERTIFICATE)
                        .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
                        .then(r => r.body)
                        .catch(e => {
                                throw new Error(`Deleting RabbitMQ account: ${e.response?.body?.reason}`);
                        });
}

const guestPermissions = `(amq\.gen.*|${ANONYMOUS_EXCHANGE})`;
const update_guest_account_permissions = (username) => !username ? Promise.resolve(null) :
        requestXHTTP
                .put(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/permissions/${RBMQ_VHOST}/${username}`)
                .send({ "configure": `^${guestPermissions}`, "write": guestPermissions, "read": guestPermissions })
                .set({ 'content-type': 'application/json' }).ca(RBMQ_CERTIFICATE)
                .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
                .then(() => ({ logType: 'info', message: `Set anonymous agent permissions in RabbitMQ` }))
                .catch(e => {
                        throw new Error(`Error while setting anonymous agent permissions in RabbitMQ: ${e.response?.body?.reason}`);
                });


const getQueueInfo = (queueName) => {
        return requestXHTTP
                .get(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/queues/${RBMQ_VHOST}/${queueName}`)
                .set({ 'content-type': 'application/json' }).ca(RBMQ_CERTIFICATE)
                .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
                .then(r => r.body);
}



const connect = amqp.connect;


module.exports.update_guest_account_permissions = update_guest_account_permissions;
module.exports.createUser = createUser;
module.exports.removeUser = removeUser;
module.exports.guestCreate_RbmqAdmin = guestCreate_RbmqAdmin;
module.exports.guestAdd_RbmqAdminVhost = guestAdd_RbmqAdminVhost;
module.exports.add_rbmq_user_vhost = add_rbmq_user_vhost;
module.exports.listConnections = listConnections;
module.exports.deleteConnections = deleteConnections;
module.exports.getQueueInfo = getQueueInfo;
module.exports.connect = connect;




