// ----------------------------------------------------------------------------
// Postgress notification pipeline setup :  Postgres -> Nodejs -> (Front-end socket or Message Broker or Ext. Service)
// ----------------------------------------------------------------------------

// Each service request is dispatched as soon its status changes to "ready_for_service" (see "ready_for_service" notification).
// The controlling of each service status is performed by the microservice_event_watchers.js procedures.
// Each microservice cand produces one or more assignments.

const blMicroservice = require('../../modules/microservice_orchestration');
const microResp = require('../microservice_event_handlers/microservice_applied_result_handler.js');
const databaseServices = require('../../services/database/database_services.js');
const extServiceCommunication = require('../../modules/communication/microservice_communication.js');
const webSocketCommunicaton = require('../../modules/communication/web_socket_communication.js');
const bufferNotifications = webSocketCommunicaton.bufferNotifications;
const {SERVICE_STATUS, MISSION_STATUS} = require('../../modules/data_models');
const { saveLogData } = require('../../modules/systemlog.js');

// Callbacks to database changes
function processMicroserviceEvents(msg) {
        let payload = JSON.parse(msg.payload);
        let service_request_id, service_request_status

        switch (msg.channel) {

        // EXTERNAL SERVICE TABLE TRIGGERS    
        // Status sequence: not_ready_for_service => wait_dependencies => ready_for_service  => pending => ready | failed | canceled
        // The status "pending" is held for {service.result_timeout} seconds, after that, it is automatically set as "failed" (see external_service_watcher.js).
             
            case 'service_requests_insertion':
                service_request_status = payload['status'];
                if(service_request_status == SERVICE_STATUS.READY_FOR_SERVICE){
                    bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                    service_request_id = payload['id'];
                    extServiceCommunication.processMicroserviceRequest(service_request_id);
                }
                break;


            case 'service_requests_update':
                service_request_status = payload['status'];
                switch (service_request_status) {
                    case SERVICE_STATUS.READY_FOR_SERVICE:
                        bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                        service_request_id = payload['id'];
                        databaseServices.service_requests.update_byId(service_request_id, {status: SERVICE_STATUS.DISPATCHING_SERVICE})
                        .then(() => blMicroservice.updateRequestContext(service_request_id))
                        .then(() => extServiceCommunication.processMicroserviceRequest(service_request_id)); // Current service status: ready_for_service => pending
                        break;			
                
                    case  SERVICE_STATUS.READY:
                        if (payload['is_result_assignment'] && !payload['assignment_dispatched'] ){
                            bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                            microResp.processMicroserviceResponse(payload)
                            .then(() => blMicroservice.wrapUpMicroserviceCall(payload))
                            .then(() => blMicroservice.activateNextServicesInPipeline(payload)) // Next service status: not_ready_for_service => wait_dependencies or ready_for_service
                            .catch(err => {
                                databaseServices.service_requests.update_byId(payload['id'], {status: SERVICE_STATUS.FAILED});
                                saveLogData('microservice', payload, 'error', err.msg);
                            });
                        } else {
                            blMicroservice.wrapUpMicroserviceCall(payload)
                            .then(() => blMicroservice.activateNextServicesInPipeline(payload)); // Next service status: not_ready_for_service => wait_dependencies or ready_for_service
                        }

                        break;

                    case SERVICE_STATUS.FAILED:
                         databaseServices.work_processes.update('id', payload['work_process_id'], {status:MISSION_STATUS.PLANNING_FAILED});
                        break;


                    case SERVICE_STATUS.TIMEOUT:
                        databaseServices.service_requests.update_byId(payload['id'], {status: SERVICE_STATUS.CANCELED});
                        databaseServices.work_processes.update('id', payload['work_process_id'], {status:MISSION_STATUS.PLANNING_FAILED});
                        break;

                    default:
                        break;
                }

                break;

            default:
                break;
        }

}


module.exports.processMicroserviceEvents = processMicroserviceEvents;