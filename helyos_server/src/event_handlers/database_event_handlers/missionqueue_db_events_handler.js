// ----------------------------------------------------------------------------
// Postgress notification pipeline setup :  Postgres -> Nodejs -> (Front-end socket or Message Broker or Ext. Service)
// ----------------------------------------------------------------------------

// A proccess is started by the insertion of a work process (see "mission_queue_insertion" notification).
// This triggers the building of a pipeline of services; the pipeline is just an ordered list of service requests 
// (see service_requests table in the Postgres schema).
// Each service request is dispatched as soon its status changes to "ready_for_service" (see "ready_for_service" notification).

const blAssignm = require('../../modules/assignment_orchestration.js');
const blMicroservice = require('../../modules/microservice_orchestration.js');
const databaseServices = require('../../services/database/database_services.js');
const webSocketCommunicaton = require('../../modules/communication/web_socket_communication.js');
const { MISSION_QUEUE_STATUS, MISSION_STATUS } = require('../../modules/data_models.js');
const bufferNotifications = webSocketCommunicaton.bufferNotifications;


// Callbacks to database changes
function processRunListEvents(msg) {
        let payload = JSON.parse(msg.payload);
        const queueId = payload['id'];
        let status;

        switch (msg.channel) {

            case 'mission_queue_insertion':
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                status = payload['status'];


                if(status == MISSION_QUEUE_STATUS.RUN) {
                    databaseServices.work_processes.select({mission_queue_id:queueId, status:'draft'}, [],'run_order ASC')
                    .then((missionList) => {
                        if (missionList.length) {
                            const nextMission = missionList[0];
                            return databaseServices.mission_queue.update_byId(queueId, {status:MISSION_QUEUE_STATUS.RUNNING})
                            .then( () => databaseServices.work_processes.update_byId(nextMission.id, {status: MISSION_STATUS.DISPATCHED}));
                        }
                    })
                    .catch(err => logData.addLog('mission_queue', payload, 'error', `mission_queue_insertion ${err.message}`));

                }
                
                                        
                break;


            case 'mission_queue_update':
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                status = payload['status'];


                if(status == MISSION_QUEUE_STATUS.RUN) {
                    databaseServices.work_processes.select({mission_queue_id:queueId, status:'draft'},[], 'run_order ASC')
                    .then((missionList) => {
                        if (missionList.length) {
                            const nextMission = missionList[0];
                            return databaseServices.mission_queue.update_byId(queueId, {status: MISSION_QUEUE_STATUS.RUNNING})
                            .then( () => databaseServices.work_processes.update_byId(nextMission.id, {status: MISSION_STATUS.DISPATCHED}));
                        }
                    })
                    .catch(err => logData.addLog('mission_queue', payload, 'error', `mission_queue_update ${err.message}`));

                }

                if(status ==  MISSION_QUEUE_STATUS.CANCEL) {
                    databaseServices.work_processes.select({mission_queue_id:queueId, status:MISSION_STATUS.EXECUTING},[], 'run_order ASC')
                    .then((missionList) => {
                        if (missionList.length) {
                            return databaseServices.mission_queue.update_byId(queueId, {status: MISSION_QUEUE_STATUS.STOPPED})
                            .then( () => 
                                    missionList.forEach(m=>databaseServices.work_processes.update_byId(m.id, {status: MISSION_STATUS.CANCELING})));
                        }
                    })
                    .catch(err => logData.addLog('mission_queue', payload, 'error', `mission_queue_update ${err.message}`));
                }


                break;


            default:
                break;
        }

}


module.exports.processRunListEvents = processRunListEvents;