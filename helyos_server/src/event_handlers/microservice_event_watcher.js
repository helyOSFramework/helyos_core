// status: not_ready_for_service => wait_dependencies => ready_for_service  => pending => ready | failed | cancelled
const extServCommunication = require('../modules/communication/microservice_communication');
const databaseServices = require('../services/database/database_services.js');
const {saveLogData} = require('../modules/systemlog');
const { SERVICE_STATUS } = require('../modules/data_models');
const { isRequestReadyForService } = require('../modules/microservice_orchestration');


const waitForServicesResults = () => {
 databaseServices.service_requests.select({status: SERVICE_STATUS.PENDING})
 .then((pendingServices) => { 
     
    pendingServices.forEach((serviceReq) => {

        extServCommunication.getExtServiceAccessData(serviceReq.service_type)
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

                    saveLogData('microservice', serviceReq, 'normal', logMsg);
                }

                
                if ((now - serviceReq.dispatched_at)/1000 > serviceReq.result_timeout) {
                    servResponse = '{"result":{}, "error": "timeout"}';
                    saveLogData('microservice', serviceReq, 'error',  "timeout to collect result");
                    return databaseServices.service_requests.update('id', serviceReq.id, { fetched: false, processed: false, response: servResponse, status: SERVICE_STATUS.TIMEOUT });
                }
            } else {
                return extServCommunication.saveServiceResponse(serviceReq.id, servResponse, SERVICE_STATUS.FAILED) // default satus is failed. if service is ok, it will be updated.
                .then( status => saveLogData('microservice', serviceReq, 'normal',  `job is ${status}`));
            }
        })
        .catch(e => {
            const msg = `service not accessible: service "${serviceReq.service_type}": ${e}`;
            saveLogData('microservice', serviceReq, 'error', msg ); 
            servResponse = '{"result":{}}';
            databaseServices.service_requests.update('id', serviceReq.id, { fetched: false, processed: true, response: servResponse, status:  SERVICE_STATUS.FAILED });
        });    

    });
    
});

}


const sendRequestToCancelServices = () => {

    databaseServices.service_requests.select({status:'canceled', processed: false})
    .then((runningServices) => { 
        
        runningServices.forEach((serviceReq) => {
            extServCommunication.getExtServiceAccessData(serviceReq.service_type)
            .then( accessData => webServices.cancelService(accessData.url, accessData.apiKey, serviceReq.service_queue_id))
            .then((servResponse) => {
                servResponse = {status:'canceled',result:{}};
                saveLogData('microservice', serviceReq, 'normal',  `job is ${servResponse.status}`);
                databaseServices.service_requests.update_byId(serviceReq.id, { fetched: true, processed: true, response: servResponse, status: 'canceled'});
            })
            .catch(e => {
                const msg = `database not accessible: service request type=${serviceReq.service_type}: ${e}`;
                saveLogData('microservice', serviceReq, 'error', msg ); 
                servResponse = '{"result":{}}';
                databaseServices.service_requests.update_byId(serviceReq.id, { fetched: false, processed: true, response: servResponse, status: 'failed' });
            });    
   
       });
       
   });
   
}

const waitForServicesDependencies = (conditions={}) =>  {
    // when first service get ready it changes the status of dependents to "wait_dependencies"
    // here we just wait to switch wait_dependencies => ready_for_service
    databaseServices.service_requests.select({status:'wait_dependencies', ...conditions})
    .then( (allAwaitingServices) => { 
        allAwaitingServices.forEach(
        async(waitingServReq) => {
            if (await isRequestReadyForService(waitingServReq)) {
               databaseServices.service_requests.updateByConditions({'id':waitingServReq.id, 'status': 'wait_dependencies'}, { status: 'ready_for_service' });
             } else {
            // @TODO: create waiting time and log each 5 secs.
            //    const msg = `service ${waitingServReq.service_type} at step ${waitingServReq.step} is waiting for dependencies.`;
            //    saveLogData('microservice', waitingServReq, 'warn', msg ); 
            }
       });
   });

}


const waitForAssigmentsDependencies =() => {
    // when first assighment get ready it changes the status of dependents to "wait_dependencies"
    // here we just wait to switch wait_dependencies => to_dispatch
    
    databaseServices.assignments.select({status:'wait_dependencies'})
    .then((allAwaitingAssignments) => { 
        allAwaitingAssignments.forEach(
        async (assignment) => {

            let completed_wp_assignments = await databaseServices.assignments.select(
                {work_process_id: assignment.work_process_id,
                 status:'completed'}, ['id']);

            completed_wp_assignments = completed_wp_assignments.map(r => r.id)
            remain_dependencies = assignment.depend_on_assignments
                                  .filter(el => !completed_wp_assignments.includes(el)); 

            if (remain_dependencies.length === 0) {
               databaseServices.assignments.update_byId(assignment.id, { status: 'to_dispatch' });
             } else {
            //   @TODO: create waiting time and log each 5 secs.
            //    const msg = `assignment ${assignment.id}  is waiting for dependencies`;
            //    saveLogData('agent',  assignment, 'warn', msg ); 

            }
       });
   });

}

function initWatcher () {

            const watcher = setInterval(() => {
                            sendRequestToCancelServices();
                            waitForServicesResults();
                            waitForServicesDependencies();
                            waitForAssigmentsDependencies(); 
                            // waitForStartTimeToProcessWorkProcess(); @TODO
                        }, 1000);

}
module.exports.initWatcher = initWatcher; 