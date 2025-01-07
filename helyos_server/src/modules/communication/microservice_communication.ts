import databaseServices from '../../services/database/database_services';
import * as webServices from '../../services/microservice_services';
import { logData } from '../systemlog';
import { SERVICE_STATUS } from '../data_models';

// ----------------------------------------------------------------------------
// EXTERNAL SERVICE COMMUNICATION
// ----------------------------------------------------------------------------

/**
 * Processes the service request by dispatching it and analyzing its status and response data.
 * @param {number} servRequestId - The ID of the service request to be processed.
 * @returns {Promise<void>}
 */
const processMicroserviceRequest = async (servRequestId: number): Promise<void> => {
    try {
        const servRequests = await databaseServices.service_requests.select({
            id: servRequestId,
            status: SERVICE_STATUS.DISPATCHING_SERVICE,
        });

        const servRequest = servRequests[0];
        if (!servRequest) {
            const msg = `Service request not found, skipped or canceled. ID=${servRequestId}`;
            logData.addLog('microservice', null, 'warn', msg);
            return;
        }

        const serviceRequestPatch = {
            fetched: true,
            processed: false,
            response: null,
            status: SERVICE_STATUS.PENDING,
        };

        let useRequestDataAsResponse = false;
        let jobQueueId: string | null = null;

        try {
            const accessData = await getExtServiceAccessData(servRequest.service_type);

            useRequestDataAsResponse = accessData.isDummy;
            const servResponse = useRequestDataAsResponse
                ? { requestId: null, ...servRequest.request }
                : await webServices.sendRequestToService(
                      accessData.url,
                      accessData.apiKey,
                      servRequest.request,
                      servRequest.context,
                      servRequest.config
                  );

            if (!servResponse) {
                const e = 'Microservice response is empty';
                logData.addLog('microservice', servRequest, 'error', e);
                throw new Error(e);
            }

            const service_dispatched_at = new Date();
            const defaultStatus = SERVICE_STATUS.PENDING;
            jobQueueId = servResponse.request_id;

            logData.addLog('microservice', servRequest, 'success', 'Request dispatched');
            const numUpdates = await databaseServices.service_requests.updateByConditions(
                { id: servRequestId, status: SERVICE_STATUS.DISPATCHING_SERVICE },
                { service_queue_id: jobQueueId, status: defaultStatus, dispatched_at: service_dispatched_at }
            );

            const _status = numUpdates === 0 ? SERVICE_STATUS.CANCELED : defaultStatus;
            await saveServiceResponse(servRequestId, servResponse, _status);
        } catch (e: any) {
            const servResponse = e.data;
            logData.addLog('microservice', servRequest, 'error', e.message);
            await databaseServices.service_requests.updateByConditions(
                {
                    id: servRequestId,
                    status__in: [
                        SERVICE_STATUS.DISPATCHING_SERVICE,
                        SERVICE_STATUS.WAIT_DEPENDENCIES,
                        SERVICE_STATUS.PENDING,
                    ],
                },
                {
                    fetched: true,
                    processed: true,
                    status: SERVICE_STATUS.FAILED,
                    response: servResponse,
                }
            );
        }
    } catch (e: any) {
        const msg = `Database access error: Request ID=${servRequestId}. ${e.message}`;
        const servResponse = '{"result":{}}';
        logData.addLog('microservice', null, 'error', msg);
        await databaseServices.service_requests.updateByConditions(
            {
                id: servRequestId,
                status__in: [
                    SERVICE_STATUS.DISPATCHING_SERVICE,
                    SERVICE_STATUS.WAIT_DEPENDENCIES,
                    SERVICE_STATUS.PENDING,
                ],
            },
            {
                fetched: false,
                processed: true,
                status: SERVICE_STATUS.FAILED,
                response: servResponse,
            }
        );
    }
};

/**
 * Retrieves access data for the external service, including URL, API key, and config.
 * @param {string} serviceType - The type of the external service as defined by the developer.
 * @returns {Promise<{url: string, apiKey: string, config: any, isDummy: boolean}>}
 */
const getExtServiceAccessData = async (
    serviceType: string
): Promise<{ url: string; apiKey: string; config: any; isDummy: boolean }> => {
    const services = await databaseServices.services.select({
        service_type: serviceType,
        enabled: true,
    });

    if (services.length === 0) {
        throw new Error('Service not found or not enabled');
    }

    const chosenService = services[0];
    const url = webServices.getExtServiceEndpoint(chosenService.service_url, chosenService.class);
    return {
        url,
        apiKey: chosenService.licence_key,
        config: chosenService.config,
        isDummy: chosenService.is_dummy,
    };
};

/**
 * Saves the service response in the database and updates its status.
 * @param {number} requestId - The ID of the service request.
 * @param {any} servResponse - The response from the external service.
 * @param {string} defaultStatus - The default status of the service request.
 * @returns {Promise<string>} - The final status of the service request.
 */
const saveServiceResponse = async (
    requestId: number,
    servResponse: any,
    defaultStatus: string
): Promise<string> => {
    const now = new Date();
    let status = defaultStatus || SERVICE_STATUS.FAILED;

    if (servResponse.result && Object.keys(servResponse.result).length > 0) status = SERVICE_STATUS.READY;
    if (servResponse.results && servResponse.results.length > 0) status = SERVICE_STATUS.READY;
    if (servResponse.status === SERVICE_STATUS.CANCELED) status = SERVICE_STATUS.CANCELED;
    if (servResponse.status === SERVICE_STATUS.FAILED) status = SERVICE_STATUS.FAILED;
    if (servResponse.status === SERVICE_STATUS.READY) status = SERVICE_STATUS.READY;

    const processed = status !== SERVICE_STATUS.PENDING;

    await databaseServices.service_requests.updateByConditions(
        {
            id: requestId,
            status__in: [
                SERVICE_STATUS.DISPATCHING_SERVICE,
                SERVICE_STATUS.WAIT_DEPENDENCIES,
                SERVICE_STATUS.PENDING,
            ],
        },
        {
            fetched: true,
            processed,
            response: servResponse,
            status,
            result_at: now,
        }
    );

    return status;
};

export { processMicroserviceRequest, getExtServiceAccessData, saveServiceResponse };