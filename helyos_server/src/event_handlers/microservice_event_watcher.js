// This module is used to watct the status of the dispatched microservices and the dependencies of the assignments.
// status: not_ready_for_service => wait_dependencies => ready_for_service  => pending => ready | failed | cancelled
//
const extServCommunication = require('../modules/communication/microservice_communication');
const databaseServices = require('../services/database/database_services.js');
const { logData} = require('../modules/systemlog');
const { SERVICE_STATUS } = require('../modules/data_models');
const { determineServiceRequestStatus } = require('../modules/microservice_orchestration');


const waitForServicesResults = () => {
 return databaseServices.service_requests.select({status: SERVICE_STATUS.PENDING})
 .then((pendingServices) => { 
     
    const promises = pendingServices.map((serviceReq) => { 

        return extServCommunication.getExtServiceAccessData(serviceReq.service_type)  
        .then( accessData => webServices.getServiceResponse(accessData.url, accessData.apiKey, serviceReq.service_queue_id))
        .then((servResponse) => {
            const now = new Date();
            if (!servResponse || servResponse.status === SERVICE_STATUS.PENDING) {
                const elpTime = (now - serviceReq.dispatched_at)/1000;
                if (Math.round(elpTime) % 5 === 0) {
                    let logMsg;
                    if (!servResponse){
                        logMsg = `service response is empty! Trying again... - ${(now - serviceReq.dispatched_at)/1000}`;
                    } else {
                        logMsg = `job not ready: elpsed time (sec) - ${(now - serviceReq.dispatched_at)/1000}` ; 
                    }

                    logData.addLog('microservice', serviceReq, 'normal', logMsg);
                }

                
                if ((now - serviceReq.dispatched_at)/1000 > serviceReq.result_timeout) {
                    servResponse = '{"result":{}, "error": "timeout"}';
                    logData.addLog('microservice', serviceReq, 'error',  `timeout to collect result: ${serviceReq.result_timeout} `);


                    return databaseServices.service_requests.updateByConditions({ id: serviceReq.id, status: SERVICE_STATUS.PENDING }, 
                                                                                                        { fetched: false, 
                                                                                                        processed: false,
                                                                                                        response: servResponse,
                                                                                                        status: SERVICE_STATUS.TIMEOUT });
                }
            } else {
                return extServCommunication.saveServiceResponse(serviceReq.id, servResponse, SERVICE_STATUS.FAILED) // default satus is failed. if service is ok, it will be updated.
                .then( status => logData.addLog('microservice', serviceReq, 'normal',  `job is ${status}`));
            }
        })
        .catch(e => {
            const msg = `service not accessible: service "${serviceReq.service_type}": ${e}`;
            logData.addLog('microservice', serviceReq, 'error', msg ); 
            servResponse = '{"result":{}}';
            return databaseServices.service_requests.update('id', serviceReq.id, { fetched: false,
                                                                            processed: true,
                                                                            response: servResponse,
                                                                            status:  SERVICE_STATUS.FAILED });
        });    

    });

    return Promise.all(promises);
    
});

}


const sendRequestToCancelServices = () => {

    return databaseServices.service_requests.select({status:SERVICE_STATUS.CANCELED, processed: false})
    .then((runningServices) => { 
        
        const promises = runningServices.map((serviceReq) => {
            extServCommunication.getExtServiceAccessData(serviceReq.service_type)
            .then( accessData => webServices.cancelService(accessData.url, accessData.apiKey, serviceReq.service_queue_id))
            .then((servResponse) => {
                servResponse = {status:'canceled',result:{}};
                logData.addLog('microservice', serviceReq, 'normal',  `Canceling signal sent to microservice: job is ${servResponse.status}`);
                return databaseServices.service_requests.updateByConditions({id: serviceReq.id, processed: false, status: SERVICE_STATUS.CANCELED},
                                                                            { fetched: true,
                                                                               processed: true,
                                                                               response: servResponse
                                                                            });
            })
            .catch(e => {
                const msg = `database not accessible: service request type=${serviceReq.service_type}: ${e}`;
                logData.addLog('microservice', serviceReq, 'error', msg ); 
                servResponse = '{"result":{}}';
                return databaseServices.service_requests.update_byId(serviceReq.id, { fetched: false,
                                                                               processed: true,
                                                                               response: servResponse,
                                                                               status:  SERVICE_STATUS.FAILED });
            });    
   
        });

        return Promise.all(promises);
   });
   
}

const waitForServicesDependencies = (conditions={}) =>  {
    // when first service get ready it changes the status of dependents to "wait_dependencies"
    // here we just wait to switch wait_dependencies => ready_for_service
    return databaseServices.service_requests.select({status:'wait_dependencies', ...conditions})
    .then( (allAwaitingServices) => { 
        const promises = allAwaitingServices.map(
        async(waitingServReq) => {

            if (SERVICE_STATUS.READY_FOR_SERVICE === await determineServiceRequestStatus(waitingServReq)) {
               return databaseServices.service_requests.updateByConditions({'id':waitingServReq.id, 'status':  SERVICE_STATUS.WAIT_DEPENDENCIES},
                                                                    { status:  SERVICE_STATUS.READY_FOR_SERVICE });
             } else {
            // @TODO: create waiting time and log each 5 secs.
            //    const msg = `service ${waitingServReq.service_type} at step ${waitingServReq.step} is waiting for dependencies.`;
            //    logData.addLog('microservice', waitingServReq, 'warn', msg ); 
            }
        });
        return Promise.all(promises);
    });

}


const waitForAssigmentsDependencies =() => {
    // when first assighment get ready it changes the status of dependents to "wait_dependencies"
    // here we just wait to switch wait_dependencies => to_dispatch
    
    return databaseServices.assignments.select({status:'wait_dependencies'})
    .then((allAwaitingAssignments) => { 
        const promises = allAwaitingAssignments.map(
        async (assignment) => {

            let completed_wp_assignments = await databaseServices.assignments.select(
                {work_process_id: assignment.work_process_id,
                 status:'completed'}, ['id']);

            completed_wp_assignments = completed_wp_assignments.map(r => r.id)
            remain_dependencies = assignment.depend_on_assignments
                                  .filter(el => !completed_wp_assignments.includes(el)); 

            if (remain_dependencies.length === 0) {
               return databaseServices.assignments.updateByConditions({'id':assignment.id, 'status':SERVICE_STATUS.WAIT_DEPENDENCIES},
                                                               { status: 'to_dispatch' });
             } else {
            //   @TODO: create waiting time and log each 5 secs.
            //    const msg = `assignment ${assignment.id}  is waiting for dependencies`;
            //    logData.addLog('agent',  assignment, 'warn', msg ); 

            }
        });

        return Promise.all(promises);
   });

}

function initWatcher () {

            const watcher = setInterval(() => {
                            sendRequestToCancelServices()
                                .catch(error => console.error('Error in sendRequestToCancelServices:', error));

                            waitForServicesResults()
                                .catch(error => console.error('Error in waitForServicesResults:', error));

                            waitForServicesDependencies()
                                .catch(error => console.error('Error in waitForServicesDependencies:', error));

                            waitForAssigmentsDependencies()
                                .catch(error => console.error('Error in waitForAssigmentsDependencies:', error));
                            // waitForStartTimeToProcessWorkProcess(); @TODO
                        }, 1000);

}
module.exports.initWatcher = initWatcher; 