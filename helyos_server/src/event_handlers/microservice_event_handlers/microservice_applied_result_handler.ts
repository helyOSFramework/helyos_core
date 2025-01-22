// Services imports
import * as DatabaseService from '../../services/database/database_services';
import * as MapResponseHandler from './microservice_map_result';
import * as pathplannerResponseHandler from './microservice_assignment_result';
import { logData } from '../../modules/systemlog';
import { SERVICE_DOMAINS } from '../../modules/data_models';

// Interfaces for type safety
interface PartialServiceRequest {
    id: number;
}

interface ServiceRequest {
    id: number;
    service_url: string;
    work_process_id: number;
    service_type: string;
    response?: any;
    result?: any;
}

interface WorkProcess {
    id: number;
    yard_id: number;
    agent_ids: number[];
}

/**
 * Processes the response of a microservice request.
 * @param partialServiceRequest Partial information about the service request.
 * @returns A promise that resolves when all tasks based on the response are completed.
 */
export async function processMicroserviceResponse(partialServiceRequest: PartialServiceRequest): Promise<void> {
    const databaseServices = await DatabaseService.getInstance();
    const serviceRequest: ServiceRequest = await databaseServices.service_requests.get_byId(partialServiceRequest.id);
    const workProcess: WorkProcess = await databaseServices.work_processes.get_byId(serviceRequest.work_process_id);
    const services = await databaseServices.services.get('service_type', serviceRequest.service_type, ['class']);
    const serviceClass: string = services[0]?.class;

    // Use the result if present as the response (temporary behavior).
    if (serviceRequest.result) {
        serviceRequest.response = serviceRequest.result;
    }
    const responseData = serviceRequest.response;

    const resultPromises: Promise<void>[] = [];

    switch (serviceClass) {
        case SERVICE_DOMAINS.STORAGE_SERVER:
            // Example: Handle storage server logic here.
            break;

        case SERVICE_DOMAINS.MAP_SERVER: {
            const resultArray = responseData.results ? responseData.results : [responseData.result];
            const mapResult = resultArray[0];
            const yardId = workProcess.yard_id;
            if (mapResult.update) {
                resultPromises.push(MapResponseHandler.updateMap(yardId, mapResult.update));
            }
            if (mapResult.create) {
                resultPromises.push(MapResponseHandler.mapCreate(mapResult.create));
            }
            break;
        }

        case 'Path planner':
        case SERVICE_DOMAINS.ASSIGNMENT_PLANNER:
            resultPromises.push(
                pathplannerResponseHandler.createAssignment(workProcess, responseData, serviceRequest)
            );
            break;

        default:
            console.error("!!! Service class is not supported yet !!!", serviceClass);
    }

    await Promise.all(resultPromises).catch((err) =>
        logData.addLog('microservice', serviceRequest, 'error', `processMicroserviceResponse ${err.message}`)
    );
}
