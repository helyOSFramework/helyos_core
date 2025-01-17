// Services imports

import rabbitMQServices from '../../services/message_broker/rabbitMQ_services';
import databaseService from '../../services/database/database_services';
import * as memDBService from '../../services/in_mem_database/mem_database_service';
import { logData } from '../../modules/systemlog';
import { AGENT_STATUS } from '../../modules/data_models';

const MESSAGE_VERSION = rabbitMQServices.MESSAGE_VERSION;

async function agentCheckOut(uuid: string, data: any, msgProps: any, registeredAgent: any, replyExchange: any): Promise<any> {
    return processAgentCheckOut(uuid)
        .then((agent) => {
            let replyTo = msgProps.replyTo ? msgProps.replyTo : agent.message_channel;
            if (replyTo) {
                replyTo = replyTo.replace(/\//g, '.');
            }

            try {
                const message = JSON.stringify({
                    type: 'checkout',
                    uuid: agent.uuid,
                    body: {
                        agentId: agent.id,
                        yard_uid: null,
                        message: 'check-out successful',
                        response_code: '200',
                    },
                    _version: MESSAGE_VERSION,
                });
                console.log('================== checkout response message to =======================');
                console.log(`${uuid} => ${agent.uuid}`);
                console.log('======================================================================');
                const public_key = agent['public_key'] || (registeredAgent && registeredAgent.public_key);
                rabbitMQServices.sendEncryptedMsg(replyTo, message, public_key);
                rabbitMQServices.sendEncryptedMsg(null, message, public_key, replyTo, replyExchange);
                return agent;
            } catch (error: any) {
                const message = JSON.stringify({
                    type: 'checkout',
                    uuid: uuid,
                    body: {
                        message: 'internal error',
                        response_code: '500',
                    },
                });
                rabbitMQServices.sendEncryptedMsg(replyTo, message);
                rabbitMQServices.sendEncryptedMsg(null, message, agent.public_key, replyTo, replyExchange);
                throw new Error(...error);
            }
        })
        .catch((err) => {
            console.log(err);
            const message = JSON.stringify({
                type: 'checkin',
                body: {
                    message: err.message,
                    response_code: err.code,
                },
                _version: MESSAGE_VERSION,
            });
            const replyToQueue = msgProps.replyTo || uuid;
            rabbitMQServices.sendEncryptedMsg(replyToQueue, message);
            throw err;
        });
}

async function processAgentCheckOut( uuid: string): Promise<any> {
    // 1 - PARSE INPUT

    // 2 - VALIDATIONS
    const agentStatus = (await databaseService.agents.get('uuid', uuid, ['status']))[0]?.status;
    if ([AGENT_STATUS.BUSY, AGENT_STATUS.READY].includes(agentStatus)) {
        throw new Error(`Agent ${uuid} cannot check out. Status ${agentStatus}.`);
    }

    // 3 - CHECK-OUT
    const agentUpdate = {
        uuid: uuid,
        yard_id: null,
        last_message_time: new Date(),
    };

    const inMemDB = await memDBService.getInstance();
    inMemDB.update('agents', 'uuid', agentUpdate, agentUpdate.last_message_time, 'buffered');
    inMemDB.countMessages('agents_stats', uuid, 'updtPerSecond');

    await databaseService.agents.updateByConditions({
        uuid,
    }, agentUpdate);
    const agents = await databaseService.agents.get('uuid', uuid, [
        'id',
        'uuid',
        'message_channel',
        'rbmq_username',
        'rbmq_encrypted_password',
        'yard_id',
        'public_key',
    ]);
    return agents[0];
}

export {
    agentCheckOut,
};
