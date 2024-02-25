databaseServices = require('../../services/database/database_services.js');
webServices = require('../../services/microservice_services.js');
const systemlog = require('../systemlog.js');
const saveLogData = systemlog.saveLogData;
const SERVICE_STATUS = require('../data_models.js').SERVICE_STATUS;
// ----------------------------------------------------------------------------
// EXTERNAL SERVICE COMMUNICATION
// ----------------------------------------------------------------------------

const getExtServiceAccessData = (serviceType) => {

    return databaseServices.services.select({service_type: serviceType, enabled: true})
    .then(services => {
        if (services.length == 0) {
            throw new Error('Service not found or not enabled');
        }
        const chosenService = services[0];
        const url = webServices.getExtServiceEndpoint(chosenService.service_url, chosenService.class);
        return {url, apiKey: chosenService.licence_key, config: chosenService.config, isDummy: chosenService.is_dummy};

    })

}



const processServiceRequest = (requestId) => { 

    databaseServices.service_requests.get_byId(requestId)
    .then((servRequest) => {
        if (!servRequest) { // @TODO Better handle this error as process failed.
            const e = `service request not found id=${requestId}`;
            saveLogData('microservice', null, 'error', e ); 
            throw Error(e);  
        } 

        const serviceRequestPatch = { fetched: true, processed: false, response: null, status: SERVICE_STATUS.PENDING};
        let useRequestDataAsResponse = false;
        let jobQueueId = null;

        getExtServiceAccessData(servRequest.service_type)
        .then(accessData => {
            useRequestDataAsResponse = accessData.isDummy;
            if (!useRequestDataAsResponse) {
                serviceRequestPatch['status'] = SERVICE_STATUS.PENDING;
                return webServices.sendRequestToService(accessData.url, accessData.apiKey, servRequest.request, servRequest.context, servRequest.config);
            } else{
                serviceRequestPatch['status'] = SERVICE_STATUS.READY;
                serviceRequestPatch['response'] =  servRequest.request;
                serviceRequestPatch['processed'] = true;
                return Promise.resolve({request_id: null});
            }
        })
        .then(servResponse => {
            if (!servResponse) {
                const e = 'Microservice response is empty';
                saveLogData('microservice', servRequest, 'error', e );
                throw Error(e);
            } 
            const service_dispatched_at = new Date();
            jobQueueId = servResponse.request_id;

            if (useRequestDataAsResponse) {
              return databaseServices.service_requests.update('id', requestId, {service_queue_id: jobQueueId, ...serviceRequestPatch});
            }
            saveLogData('microservice', servRequest, 'success', 'request dispatched' );
            return databaseServices.service_requests.update('id', requestId, {service_queue_id: jobQueueId, status:SERVICE_STATUS.PENDING, dispatched_at: service_dispatched_at})
                   .then(() => saveServiceResponse(requestId, servResponse, SERVICE_STATUS.PENDING));
        })
        .catch(e => {
            const servResponse = e.data;
            saveLogData('microservice', servRequest, 'error', e );
            return databaseServices.service_requests.update('id', requestId, { fetched: false, processed: true,  status: SERVICE_STATUS.FAILED, response: servResponse});
        });
    })
    .catch(e => {
        const msg = `database access: request id=${requestId} ${e}`;
        const servResponse = '{"result":{}}';
        saveLogData('microservice', null, 'error', msg ); 
        databaseServices.service_requests.update('id', requestId, { fetched: true, processed: true,  status: SERVICE_STATUS.FAILED, response: servResponse});
    });
}



const saveServiceResponse = (requestId, servResponse, defaultStatus) => {
        const now = new Date();
        let status = defaultStatus || SERVICE_STATUS.FAILED;
        if(servResponse.result && Object.keys(servResponse.result).length > 0) status = SERVICE_STATUS.READY;
        if(servResponse.results && servResponse.results.length > 0) status = SERVICE_STATUS.READY;
        if(servResponse.status && servResponse.status ==  SERVICE_STATUS.CANCELED) status = SERVICE_STATUS.CANCELED;
        if(servResponse.status && servResponse.status == SERVICE_STATUS.FAILED) status = SERVICE_STATUS.FAILED;
        if(servResponse.status && servResponse.status == SERVICE_STATUS.READY) status = SERVICE_STATUS.READY;

        return databaseServices.service_requests.update_byId(requestId, { fetched: true, processed: true, response: servResponse,
                                                             status: status, result_at: now})
                                                            .then(() => status);
}


module.exports.processServiceRequest = processServiceRequest;
module.exports.getExtServiceAccessData = getExtServiceAccessData;
module.exports.saveServiceResponse = saveServiceResponse;
