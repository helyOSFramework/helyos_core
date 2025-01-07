// ----------------------------------------------------------------------------
// RabbitMQ interface layer
// ----------------------------------------------------------------------------

import * as amqp from 'amqplib';
import requestXHTTP from 'superagent';
import config from '../../config';

const { 
  RBMQ_HOST, 
  RBMQ_API_PORT, 
  RBMQ_CNAME, 
  RBMQ_ADMIN_USERNAME, 
  RBMQ_SSL, 
  RBMQ_API_SSL,
  RBMQ_ADMIN_PASSWORD, 
  RBMQ_VHOST, 
  API_PROTOCOL,
  RBMQ_CERTIFICATE, 
  ANONYMOUS_EXCHANGE 
} = config;

interface Permissions {
  configure: string;
  write: string;
  read: string;
}

const guestCreate_RbmqAdmin = (username: string, password: string, tags: string[]): Promise<{ logType: string; message: string }> =>
  requestXHTTP
    .put(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/users/${username}`)
    .send({ username, password, tags })
    .set({ 'content-type': 'application/json' })
    .ca(RBMQ_CERTIFICATE)
    .auth('guest', 'guest')
    .then(() => ({ logType: 'info', message: `RabbitMQ admin created for ${username}` }))
    .catch(e => {
      throw new Error(`Error in creating RabbitMQ admin account for ${username}: ${e.response?.body?.reason}`);
    });

const guestAdd_RbmqAdminVhost = (username: string): Promise<{ logType: string; message: string }> =>
  !username
    ? Promise.resolve({ logType: 'error', message: 'No username provided' })
    : requestXHTTP
        .put(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/permissions/${RBMQ_VHOST}/${username}`)
        .send({ configure: '.*', write: '.*', read: '.*' })
        .set({ 'content-type': 'application/json' })
        .ca(RBMQ_CERTIFICATE)
        .auth('guest', 'guest')
        .then(() => ({ logType: 'info', message: `Set ${username} permissions in RabbitMQ/${RBMQ_VHOST}` }))
        .catch(e => {
          throw new Error(`VHOST PERMISSION: ${e.response?.body?.reason}`);
        });

const createUser = (username: string, password: string, tags: string[]): Promise<{ logType: string; message: string}> =>
  !username
    ? Promise.resolve({ logType:'error', message: 'No username provided' })
    : requestXHTTP
        .put(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/users/${username}`)
        .send({ username, password, tags })
        .set({ 'content-type': 'application/json' })
        .ca(RBMQ_CERTIFICATE)
        .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
        .then(() => ({ logType: 'info', message: `RabbitMQ account created for ${username}` }))
        .catch(e => {
          throw new Error(`Error in creating RabbitMQ account: ${e.response?.body?.reason}`);
        });

const removeUser = (username: string): Promise<{ logType: string; message: string } | null> =>
  !username
    ? Promise.resolve(null)
    : requestXHTTP
        .delete(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/users/${username}`)
        .set({ 'content-type': 'application/json' })
        .ca(RBMQ_CERTIFICATE)
        .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
        .then(() => ({ logType: 'info', message: `RabbitMQ ${username} account deleted` }))
        .catch(e => {
          throw new Error(`DELETE ACCOUNT RMBTMQ: ${e.response?.body?.reason}`);
        });

const addRbmqUserVhost = (username: string, permissions: Permissions = { configure: '.*', write: '.*', read: '.*' }): Promise<{ logType: string; message: string } | null> =>
  !username
    ? Promise.resolve(null)
    : requestXHTTP
        .put(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/permissions/${RBMQ_VHOST}/${username}`)
        .send({ configure: permissions.configure, write: permissions.write, read: permissions.read })
        .set({ 'content-type': 'application/json' })
        .ca(RBMQ_CERTIFICATE)
        .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
        .then(() => ({ logType: 'info', message: `Set account permissions within RabbitMQ-vhost:${RBMQ_VHOST}` }))
        .catch(e => {
          throw new Error(`VHOST PERMISSION: ${e.response?.body?.reason}`);
        });

const listConnections = (username: string): Promise<any | null> =>
  !username
    ? Promise.resolve(null)
    : requestXHTTP
        .get(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/connections/username/${username}`)
        .set({ 'content-type': 'application/json' })
        .ca(RBMQ_CERTIFICATE)
        .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
        .then(r => r.body)
        .catch(e => {
          throw new Error(`VHOST PERMISSION:${e.response?.body?.reason}`);
        });

const deleteConnections = (username: string): Promise<any> =>
  !username
    ? Promise.resolve(null)
    : requestXHTTP
        .delete(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/connections/username/${username}`)
        .set({ 'content-type': 'application/json', 'X-Reason': 'exceed update rate' })
        .ca(RBMQ_CERTIFICATE)
        .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
        .then(r => r.body)
        .catch(e => {
          throw new Error(`Deleting RabbitMQ account: ${e.response?.body?.reason}`);
        });

const guestPermissions = `(amq\\.gen.*|${ANONYMOUS_EXCHANGE})`;

const updateGuestAccountPermissions = (username: string): Promise<{ logType: string; message: string }> =>
  !username
    ? Promise.resolve({ logType:'error', message: 'No username provided' })
    : requestXHTTP
        .put(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/permissions/${RBMQ_VHOST}/${username}`)
        .send({ configure: `^${guestPermissions}`, write: guestPermissions, read: guestPermissions })
        .set({ 'content-type': 'application/json' })
        .ca(RBMQ_CERTIFICATE)
        .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
        .then(() => ({ logType: 'info', message: `Set anonymous agent permissions in RabbitMQ` }))
        .catch(e => {
          throw new Error(`Error while setting anonymous agent permissions in RabbitMQ: ${e.response?.body?.reason}`);
        });

const getQueueInfo = (queueName: string): Promise<any> =>
  requestXHTTP
    .get(`${API_PROTOCOL}://${RBMQ_HOST}:${RBMQ_API_PORT}/api/queues/${RBMQ_VHOST}/${queueName}`)
    .set({ 'content-type': 'application/json' })
    .ca(RBMQ_CERTIFICATE)
    .auth(RBMQ_ADMIN_USERNAME, RBMQ_ADMIN_PASSWORD)
    .then(r => r.body);

const connect = amqp.connect;

export interface Channel extends amqp.Channel{};

export default {
  updateGuestAccountPermissions,
  createUser,
  removeUser,
  guestCreate_RbmqAdmin,
  guestAdd_RbmqAdminVhost,
  addRbmqUserVhost,
  listConnections,
  deleteConnections,
  getQueueInfo,
  connect
};
