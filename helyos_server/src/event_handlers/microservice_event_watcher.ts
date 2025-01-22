import * as extServCommunication from '../modules/communication/microservice_communication';
import * as DatabaseService from '../services/database/database_services';
import { logData } from '../modules/systemlog';
import { SERVICE_STATUS, ASSIGNMENT_STATUS } from '../modules/data_models';
import { determineServiceRequestStatus } from '../modules/microservice_orchestration';
import * as webServices from '../services/microservice_services';


interface ServiceRequest {
    id: number;
    service_type: string;
    service_queue_id: string;
    dispatched_at: Date;
    result_timeout: number;
    status: string;
    [key: string]: any;
}

interface Assignment {
    id: string;
    work_process_id: string;
    depend_on_assignments: string[];
    status: string;
    [key: string]: any;
}

const waitForServicesResults = async (): Promise<void> => {
    try {
        const databaseServices = await DatabaseService.getInstance();
        const pendingServices = await databaseServices.service_requests.select({ status: SERVICE_STATUS.PENDING });

        const promises = pendingServices.map(async (serviceReq: ServiceRequest) => {
            try {
                const accessData = await extServCommunication.getExtServiceAccessData(serviceReq.service_type);
                const servResponse = await webServices.getServiceResponse(accessData.url, accessData.apiKey, serviceReq.service_queue_id);
                const now = new Date();
                if (!servResponse || servResponse.status === SERVICE_STATUS.PENDING) {
                    const elpTime = (now.getTime() - new Date(serviceReq.dispatched_at).getTime()) / 1000;
                    if (Math.round(elpTime) % 5 === 0) {
                        const logMsg = !servResponse
                            ? `service response is empty! Trying again... - ${elpTime}`
                            : `job not ready: elapsed time (sec) - ${elpTime}`;
                        logData.addLog('microservice', serviceReq, 'info', logMsg);
                    }
                    if (elpTime > serviceReq.result_timeout) {
                        const timeoutResponse = '{"result":{}, "error": "timeout"}';
                        logData.addLog('microservice', serviceReq, 'error', `timeout to collect result: ${serviceReq.result_timeout}`);
                        return databaseServices.service_requests.updateByConditions(
                            { id: serviceReq.id, status: SERVICE_STATUS.PENDING },
                            { fetched: false, processed: false, response: timeoutResponse, status: SERVICE_STATUS.TIMEOUT }
                        );
                    }
                } else {
                    const status = await extServCommunication.saveServiceResponse(serviceReq.id, servResponse, SERVICE_STATUS.FAILED);
                    logData.addLog('microservice', serviceReq, 'info', `job is ${status}`);
                    return Promise.resolve();
                }
            } catch (e) {
                const msg = `service not accessible: service "${serviceReq.service_type}": ${e}`;
                logData.addLog('microservice', serviceReq, 'error', msg);
                const servResponse = '{"result":{}}';
                await databaseServices.service_requests.update('id', serviceReq.id, {
                    fetched: false,
                    processed: true,
                    response: servResponse,
                    status: SERVICE_STATUS.FAILED
                });
            }
        });

        await Promise.all(promises);
    } catch (error) {
        console.error('Error in waitForServicesResults:', error);
    }
};

const sendRequestToCancelServices = async (): Promise<void> => {
    try {
        const databaseServices = await DatabaseService.getInstance();
        const runningServices = await databaseServices.service_requests.select({ status: SERVICE_STATUS.CANCELED, processed: false });

        const promises = runningServices.map(async (serviceReq: ServiceRequest) => {
            try {
                const accessData = await extServCommunication.getExtServiceAccessData(serviceReq.service_type);
                await webServices.cancelService(accessData.url, accessData.apiKey, serviceReq.service_queue_id);
                const canceledResponse = { status: 'canceled', result: {} };
                logData.addLog('microservice', serviceReq, 'info', `Canceling signal sent to microservice`);
                await databaseServices.service_requests.updateByConditions(
                    { id: serviceReq.id, processed: false, status: SERVICE_STATUS.CANCELED },
                    { fetched: true, processed: true, response: canceledResponse }
                );
            } catch (e) {
                const msg = `database not accessible: service request type=${serviceReq.service_type}: ${e}`;
                logData.addLog('microservice', serviceReq, 'error', msg);
                const servResponse = '{"result":{}}';
                await databaseServices.service_requests.update_byId(serviceReq.id, {
                    fetched: false,
                    processed: true,
                    response: servResponse,
                    status: SERVICE_STATUS.FAILED
                });
            }
        });

        await Promise.all(promises);
    } catch (error) {
        console.error('Error in sendRequestToCancelServices:', error);
    }
};

const waitForServicesDependencies = async (conditions: object = {}): Promise<void> => {
    try {
        const databaseServices = await DatabaseService.getInstance();
        const allAwaitingServices = await databaseServices.service_requests.select({ status: 'wait_dependencies', ...conditions });

        const promises = allAwaitingServices.map(async (waitingServReq: ServiceRequest) => {
            if (SERVICE_STATUS.READY_FOR_SERVICE === await determineServiceRequestStatus(waitingServReq as any)) {
                await databaseServices.service_requests.updateByConditions(
                    { id: waitingServReq.id, status: SERVICE_STATUS.WAIT_DEPENDENCIES },
                    { status: SERVICE_STATUS.READY_FOR_SERVICE }
                );
            }
        });

        await Promise.all(promises);
    } catch (error) {
        console.error('Error in waitForServicesDependencies:', error);
    }
};

const waitForAssigmentsDependencies = async (): Promise<void> => {
    try {
        const databaseServices = await DatabaseService.getInstance();
        const allAwaitingAssignments = await databaseServices.assignments.select({ status: ASSIGNMENT_STATUS.WAIT_DEPENDENCIES });

        const promises = allAwaitingAssignments.map(async (assignment: Assignment) => {
            const completedAssignments = await databaseServices.assignments.select(
                { work_process_id: assignment.work_process_id, status: 'completed' },
                ['id']
            );

            const completedAssignmentIds = completedAssignments.map(r => r.id);
            const remainingDependencies = assignment.depend_on_assignments.filter(el => !completedAssignmentIds.includes(el));

            if (remainingDependencies.length === 0) {
                await databaseServices.assignments.updateByConditions(
                    { id: assignment.id, status: SERVICE_STATUS.WAIT_DEPENDENCIES },
                    { status: 'to_dispatch' }
                );
            }
        });

        await Promise.all(promises);
    } catch (error) {
        console.error('Error in waitForAssigmentsDependencies:', error);
    }
};

function initWatcher(): void {
    setInterval(() => {
        sendRequestToCancelServices().catch(error => console.error('Error in sendRequestToCancelServices:', error));

        waitForServicesResults().catch(error => console.error('Error in waitForServicesResults:', error));

        waitForServicesDependencies().catch(error => console.error('Error in waitForServicesDependencies:', error));

        waitForAssigmentsDependencies().catch(error => console.error('Error in waitForAssigmentsDependencies:', error));
        // waitForStartTimeToProcessWorkProcess(); @TODO
    }, 1000);
}

export default { initWatcher };