databaseServices = require('../../services/database/database_services.js');
webServices = require('../../services/microservice_services.js');
const {logData} = require('../systemlog.js');
const SERVICE_STATUS = require('../data_models.js').SERVICE_STATUS;
// ----------------------------------------------------------------------------
// EXTERNAL SERVICE COMMUNICATION
// ----------------------------------------------------------------------------


/** 
** processMicroserviceRequest
** @param {number} servRequestId - The id of the service request to be processed.
** @returns {Promise}
** @description
** This function processes the service request, by dispatching it and analyzing its status and response data.
*/
const processMicroserviceRequest = (servRequestId) => { 

    databaseServices.service_requests.select({id: servRequestId, status: SERVICE_STATUS.DISPATCHING_SERVICE})
    .then((servRequests) => {
        const servRequest = servRequests[0];
        if (!servRequest) { // @TODO Better handle this error as process failed.
            const e = `service request not found or canceled. id=${servRequestId}`;
            throw Error(e);  
        } 

        const serviceRequestPatch = { fetched: true, processed: false, response: null, status: SERVICE_STATUS.PENDING};
        let useRequestDataAsResponse = false;
        let jobQueueId = null;

        return getExtServiceAccessData(servRequest.service_type)
        .then(accessData => {
            useRequestDataAsResponse = accessData.isDummy;
            if (useRequestDataAsResponse) {
                return Promise.resolve({requestId:null, ...servRequest.request||{}});
           } else{
                return webServices.sendRequestToService(accessData.url, accessData.apiKey, servRequest.request, servRequest.context, servRequest.config);
            }
        })
        .then(servResponse => {
            if (!servResponse) {
                const e = 'Microservice response is empty';
                logData.addLog('microservice', servRequest, 'error', e );
                throw Error(e);
            } 
            const service_dispatched_at = new Date();
            const defaultStatus = SERVICE_STATUS.PENDING;
            jobQueueId = servResponse.request_id;
            
            logData.addLog('microservice', servRequest, 'success', 'request dispatched' );
            return databaseServices.service_requests.updateByConditions( {'id': servRequestId, 'status':SERVICE_STATUS.DISPATCHING_SERVICE },
                                                                         {service_queue_id: jobQueueId, status:defaultStatus, dispatched_at: service_dispatched_at})
                   .then((numUpdates) => {
                        const _status = numUpdates == 0 ? SERVICE_STATUS.CANCELED : defaultStatus;
                        return saveServiceResponse(servRequestId, servResponse, _status);
                    });
        })
        .catch(e => {
            const servResponse = e.data;
            logData.addLog('microservice', servRequest, 'error', e.message );
            return databaseServices.service_requests.updateByConditions({   'id': servRequestId, 
                                                                            'status__in': [ SERVICE_STATUS.DISPATCHING_SERVICE,
                                                                                            SERVICE_STATUS.WAIT_DEPENDENCIES,
                                                                                            SERVICE_STATUS.PENDING] },
                                                                            { fetched: true, processed: true,  status: SERVICE_STATUS.FAILED, response: servResponse});
        });


    })
    .catch(e => {
        const msg = `database access: request id=${servRequestId} ${e}`;
        const servResponse = '{"result":{}}';
        logData.addLog('microservice', null, 'error', msg ); 
        return databaseServices.service_requests.updateByConditions({'id': servRequestId, 
                                                                    'status__in': [ SERVICE_STATUS.DISPATCHING_SERVICE,
                                                                                    SERVICE_STATUS.WAIT_DEPENDENCIES,
                                                                                    SERVICE_STATUS.PENDING] },
                                                                     { fetched: false, processed: true,  status: SERVICE_STATUS.FAILED, response: servResponse});
    });
}



/** 
** getExtServiceAccessData
** @param {string} serviceType - The type of the external service, as defined by the developer.
** @returns {Promise}
** @description
** This function returns the access data for the external service, as url, apiKey and config.
** It also returns a flag to indicate if the service is a dummy service.
*/
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



const saveServiceResponse = (requestId, servResponse, defaultStatus) => {
        const now = new Date();
        let status = defaultStatus || SERVICE_STATUS.FAILED;
        if(servResponse.result && Object.keys(servResponse.result).length > 0) status = SERVICE_STATUS.READY;
        if(servResponse.results && servResponse.results.length > 0) status = SERVICE_STATUS.READY;
        if(servResponse.status && servResponse.status ==  SERVICE_STATUS.CANCELED) status = SERVICE_STATUS.CANCELED;
        if(servResponse.status && servResponse.status == SERVICE_STATUS.FAILED) status = SERVICE_STATUS.FAILED;
        if(servResponse.status && servResponse.status == SERVICE_STATUS.READY) status = SERVICE_STATUS.READY;

        return databaseServices.service_requests.updateByConditions({'id': requestId, 
                                                                     'status__in': [SERVICE_STATUS.DISPATCHING_SERVICE,
                                                                                    SERVICE_STATUS.WAIT_DEPENDENCIES,
                                                                                    SERVICE_STATUS.PENDING]},
                                                                    { fetched: true, processed: true, response: servResponse,
                                                                       status: status, result_at: now})
                                                .then(() => status);
}


module.exports.processMicroserviceRequest = processMicroserviceRequest;
module.exports.getExtServiceAccessData = getExtServiceAccessData;
module.exports.saveServiceResponse = saveServiceResponse;
