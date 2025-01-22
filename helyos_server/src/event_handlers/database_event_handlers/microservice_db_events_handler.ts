
import * as blMicroservice from '../../modules/microservice_orchestration';
import * as microResp from '../microservice_event_handlers/microservice_applied_result_handler.js';
import * as DatabaseService from '../../services/database/database_services';
import * as extServiceCommunication from '../../modules/communication/microservice_communication';
import { SERVICE_STATUS, MISSION_STATUS } from '../../modules/data_models';
import { logData } from '../../modules/systemlog';

// ----------------------------------------------------------------------------
// Postgress notification pipeline setup :  Postgres -> Nodejs -> (Front-end socket or Message Broker or Ext. Service)
// ----------------------------------------------------------------------------

// Each service request is dispatched as soon its status changes to "ready_for_service" (see "ready_for_service" notification).
// The controlling of each service status is performed by the microservice_event_watchers.js procedures.
// Each microservice cand produces one or more assignments.


// Callbacks to database changes
async function processMicroserviceEvents(channel: string, payload: any) {
    const databaseServices = await DatabaseService.getInstance();
    let service_request_id: number, service_request_status: string;

    switch (channel) {

        // EXTERNAL SERVICE TABLE TRIGGERS    
        // Status sequence: not_ready_for_service => wait_dependencies => ready_for_service  => pending => ready | failed | canceled
        // The status "pending" is held for {service.result_timeout} seconds, after that, it is automatically set as "failed" (see external_service_watcher.js).

        case 'service_requests_insertion':
            service_request_status = payload['status'];
            if (service_request_status == SERVICE_STATUS.READY_FOR_SERVICE) {
                service_request_id = payload['id'];

                databaseServices.work_processes.get_byId(payload['work_process_id'], ['status'])
                    .then(work_process => {
                        if ([MISSION_STATUS.FAILED, MISSION_STATUS.CANCELING,
                        MISSION_STATUS.CANCELED, MISSION_STATUS.PLANNING_FAILED].includes(work_process.status)) {
                            return databaseServices.service_requests.update_byId(service_request_id, { status: SERVICE_STATUS.CANCELED });
                        }

                        return databaseServices.service_requests.updateByConditions({
                            id: service_request_id, status: SERVICE_STATUS.READY_FOR_SERVICE
                        },
                            { status: SERVICE_STATUS.DISPATCHING_SERVICE })
                            .then(() => extServiceCommunication.processMicroserviceRequest(service_request_id));
                    })
                    .catch(err => logData.addLog('microservice', payload, 'error', `service_requests_insertion ${err?.message}`));
            }

            break;

        case 'service_requests_update':
            service_request_status = payload['status'];

            switch (service_request_status) {

                case SERVICE_STATUS.READY_FOR_SERVICE:
                    service_request_id = payload['id'];
                    databaseServices.service_requests.updateByConditions({
                        id: service_request_id, status: SERVICE_STATUS.READY_FOR_SERVICE
                    },
                        { status: SERVICE_STATUS.DISPATCHING_SERVICE })
                        .then(() => blMicroservice.updateRequestContext(service_request_id))
                        .then(() => extServiceCommunication.processMicroserviceRequest(service_request_id)) // Current service status: ready_for_service => pending
                        .catch(err => logData.addLog('microservice', payload, 'error', `service_requests_update ${err?.message}`));

                    break;

                case SERVICE_STATUS.READY:
                    if (payload['is_result_assignment'] && !payload['assignment_dispatched']) {
                        microResp.processMicroserviceResponse(payload)
                            .then(() => blMicroservice.wrapUpMicroserviceCall(payload))
                            .then(() => blMicroservice.activateNextServicesInPipeline(payload)) // Next service status: not_ready_for_service => wait_dependencies or ready_for_service
                            .catch(err => {
                                databaseServices.service_requests.update_byId(payload['id'], { status: SERVICE_STATUS.FAILED });
                                logData.addLog('microservice', payload, 'error', err.message);
                            });
                    } else {
                        blMicroservice.wrapUpMicroserviceCall(payload)
                            .then(() => blMicroservice.activateNextServicesInPipeline(payload)) // Next service status: not_ready_for_service => wait_dependencies or ready_for_service
                            .catch(err => logData.addLog('microservice', payload, 'error', `service_requests_update ${err?.message}`));
                    }

                    break;

                case SERVICE_STATUS.SKIPPED:
                    blMicroservice.wrapUpMicroserviceCall(payload)
                        .catch(err => logData.addLog('microservice', payload, 'error', `service_requests_update ${err?.message}`));
                    break;

                case SERVICE_STATUS.FAILED:
                    databaseServices.work_processes.updateByConditions({ id: payload['work_process_id'],
                        status__in: [MISSION_STATUS.PREPARING,
                            MISSION_STATUS.CALCULATING,
                            MISSION_STATUS.EXECUTING]
                    },
                        { status: MISSION_STATUS.PLANNING_FAILED })
                        .catch(err => logData.addLog('microservice', payload, 'error', `service_requests_update ${err?.message}`));

                    break;

                case SERVICE_STATUS.TIMEOUT:
                    databaseServices.service_requests.update_byId(payload['id'], { status: SERVICE_STATUS.CANCELED });
                    databaseServices.work_processes.updateByConditions({ id: payload['work_process_id'],
                        status__in: [MISSION_STATUS.PREPARING,
                            MISSION_STATUS.CALCULATING,
                            MISSION_STATUS.EXECUTING]
                    },
                        { status: MISSION_STATUS.PLANNING_FAILED })
                        .catch(err => logData.addLog('microservice', payload, 'error', `service_requests_update ${err?.message}`));

                    break;

                default:
                    break;
            }

            break;

        default:
            break;
    }

}

export { processMicroserviceEvents };
