// ----------------------------------------------------------------------------
// Postgress notification pipeline setup :  Postgres -> Nodejs -> (Front-end socket or Message Broker or Ext. Service)
// ----------------------------------------------------------------------------

const databaseServices = require('../../services/database/database_services.js');
const agentComm = require('../../modules/communication/agent_communication.js');
const {logData} = require('../../modules/systemlog.js');



// Callbacks to database changes
async function processInstantActionEvents(msg) {
        let payload = JSON.parse(msg.payload);
    

        switch (msg.channel) {

            case 'instant_actions_insertion':
                let agentId = payload['agent_id'];
                let agentUuid = payload['agent_uuid'];

                if  (agentId && !agentUuid) {
                    const uuids = await databaseServices.agents.getIds([payload['uuid']]);
                    agentUuid = uuids[0];
                 };

                if  (!agentId && payload.uuid) {
                   const agentIds = await databaseServices.agents.getIds([payload['uuid']]);
                   agentId = agentIds[0];
                };

                if (agentId) {
                    agentComm.sendCustomInstantActionToAgent(agentId, payload['command']);
                }
                const log = {...payload, agentId: agentId, agentUuid: agentUuid};
                logData.addLog('agent', log, 'normal', `send custom instant action to agent`);	

                break;

            default:
                break;
        }

}


module.exports.processInstantActionEvents = processInstantActionEvents;