// ----------------------------------------------------------------------------
// Postgress notification pipeline setup :  Postgres -> Nodejs -> (Front-end socket or Message Broker or Ext. Service)
// ----------------------------------------------------------------------------

// A proccess is started by the insertion of a work process (see "work_processes_insertion" notification).
// This triggers the building of a pipeline of services; the pipeline is just an ordered list of service requests 
// (see service_requests table in the Postgres schema).
// Each service request is dispatched as soon its status changes to "ready_for_service" (see "ready_for_service" notification).


const blAssignm = require('../../modules/assignment_orchestration.js');
const blMicroservice = require('../../modules/microservice_orchestration');
const databaseServices = require('../../services/database/database_services.js');
const webSocketCommunicaton = require('../../modules/communication/web_socket_communication.js');
const {MISSION_STATUS, ASSIGNMENT_STATUS, ON_ASSIGNMENT_FAILURE_ACTIONS } = require('../../modules/data_models.js');
const { logData } = require('../../modules/systemlog.js');
const bufferNotifications = webSocketCommunicaton.bufferNotifications;


// Callbacks to database changes
function processWorkProcessEvents(msg) {
        let payload = JSON.parse(msg.payload);
        let workProcessId;
        let workProcessStatus;

        switch (msg.channel) {

            case 'work_processes_insertion':
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                workProcessId = payload['id'];
                workProcessStatus = payload['status'];
                let prepareWPData = Promise.resolve();

                const yard_uid = payload['yard_uid'];
                if (yard_uid) {
                    prepareWPData = databaseServices.yards.select({uid: yard_uid},['id'])
                                    .then(r => databaseServices.work_processes.update_byId(workProcessId, {yard_id: r[0].id}));
                }

                let uuids = payload['agent_uuids'];

                // Deprecated: compatibility with tool table.
                if (!(uuids && uuids.length)) {
                    uuids = payload['tools_uuids']
                }
                //

                if (uuids && uuids.length) {
                    prepareWPData = prepareWPData.then(() => (databaseServices.agents.getIds(uuids)
                                    .then(agentIds => { 
                                        return databaseServices.work_processes.update_byId(workProcessId, {agent_ids: agentIds})})));
                }

                if(workProcessStatus == MISSION_STATUS.DISPATCHED || workProcessStatus == 'created')  // "created": for compatiblity with old GUI 
                    databaseServices.work_processes.update_byId(payload['id'], {status: MISSION_STATUS.PREPARING})
                    .then(()=> prepareWPData
                    .then(() => blMicroservice.prepareServicesPipelineForWorkProcess(payload)))
                    .catch(err => {
                        console.log(err);
                        logData.addLog('helyos_core', {wproc_id: payload['id']},'error',  `work_processes_insertion ${err}`);
                    });
            
                else {
                    prepareWPData.then()
                    .catch(err => {
                        console.log(err);
                        logData.addLog('helyos_core', {wproc_id: payload['id']},'error',  `work_processes_insertion ${err}`);
                    });
                }
                                        
                break;


            case 'work_processes_update':
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                bufferNotifications.pushNotificationToFrontEnd('change_work_processes', payload); // keep for compatibility with old JS SDK versions.
                workProcessStatus = payload['status'];
                console.log(`WORKPROCESS ${payload['id']} STATUS: `, workProcessStatus);
                switch (workProcessStatus) {

                    case MISSION_STATUS.DISPATCHED:
                        databaseServices.work_processes.update_byId(payload['id'], {status: MISSION_STATUS.PREPARING})
                        .then(() => blMicroservice.prepareServicesPipelineForWorkProcess(payload))
                        .catch(err => {logData.addLog('helyos_core', {wproc_id: payload['id']},'error',  `p ${err.message}`)});
                        break;

                    case 'cancelling':
                        databaseServices.work_processes.update_byId(payload['id'], {status:MISSION_STATUS.CANCELED})
                        .then(() => blAssignm.cancelRequestsToMicroservicesByWPId(payload['id']))
                        .then(() => blAssignm.cancelWorkProcessAssignments(payload['id']))
                        .then(() => blAssignm.onWorkProcessEnd(payload['id'], workProcessStatus))
                        .catch(err => {logData.addLog('helyos_core', {wproc_id: payload['id']},'error',  `work_processes_update ${err.message}`)});

                        break;

                    case MISSION_STATUS.CANCELING:
                        databaseServices.work_processes.update_byId(payload['id'], {status:MISSION_STATUS.CANCELED})
                        .then(() => blAssignm.cancelRequestsToMicroservicesByWPId(payload['id']))
                        .then(() => blAssignm.cancelWorkProcessAssignments(payload['id']))
                        .then(() => blAssignm.onWorkProcessEnd(payload['id'], workProcessStatus))
                        .catch(err => {logData.addLog('helyos_core', {wproc_id: payload['id']},'error',  `work_processes_update ${err.message}`)});

                        break;

                    case MISSION_STATUS.ASSIGNMENT_FAILED:
                        databaseServices.work_processes.update_byId(payload['id'], {status:MISSION_STATUS.FAILED})
                        .then(() => blAssignm.cancelRequestsToMicroservicesByWPId(payload['id']))
                        .then(() => blAssignm.cancelWorkProcessAssignments(payload['id']))
                        .then(() => blAssignm.onWorkProcessEnd(payload['id'], workProcessStatus))
                        .catch(err => {logData.addLog('helyos_core', {wproc_id: payload['id']},'error',  `work_processes_update ${err.message}`)});

                        break;

                    case MISSION_STATUS.PLANNING_FAILED:
                        databaseServices.work_processes.update_byId(payload['id'], {status:MISSION_STATUS.FAILED})
                        .then(() => blAssignm.cancelRequestsToMicroservicesByWPId(payload['id']))
                        .then(() => blAssignm.cancelWorkProcessAssignments(payload['id']))
                        .then(() => blAssignm.onWorkProcessEnd(payload['id'], workProcessStatus))
                        .catch(err => {logData.addLog('helyos_core', {wproc_id: payload['id']},'error',  `work_processes_update ${err.message}`)});

                        break;

                    case MISSION_STATUS.ASSIGNMENTS_COMPLETED:
                        databaseServices.assignments.select({work_process_id:payload['id'], status: ASSIGNMENT_STATUS.CANCELED})
                        .then( r => {
                            let w_process_status = r.length? MISSION_STATUS.CANCELED : MISSION_STATUS.SUCCEEDED;
                            databaseServices.work_processes.update_byId(payload['id'], {status:w_process_status})
                            .then(()=>blAssignm.onWorkProcessEnd(payload['id'], workProcessStatus));
                        })
                        .catch(err => {logData.addLog('helyos_core', {wproc_id: payload['id']},'error',  `work_processes_update ${err.message}`)});

                        break;

                        
                    default:
                        break;
                }
                

                break; 


            default:
                break;
        }

}


module.exports.processWorkProcessEvents = processWorkProcessEvents;