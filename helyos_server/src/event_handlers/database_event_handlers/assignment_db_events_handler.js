// ----------------------------------------------------------------------------
// Postgress notification pipeline setup :  Postgres -> Nodejs -> (Front-end socket or Message Broker or Ext. Service)
// ----------------------------------------------------------------------------

// The microservices produces one or more assignments.
// The assignments are sent to the agents.


const blAssignm = require('../../modules/assignment_orchestration.js')
const databaseServices = require('../../services/database/database_services.js')
const webSocketCommunicaton = require('../../modules/communication/web_socket_communication.js');
const agentComm = require('../../modules/communication/agent_communication.js');

const { logData } = require('../../modules/systemlog.js');
const {ASSIGNMENT_STATUS, MISSION_STATUS, ON_ASSIGNMENT_FAILURE_ACTIONS} = require('../../modules/data_models.js');
const bufferNotifications = webSocketCommunicaton.bufferNotifications;



function wrapUpAssignment(assignment) {
   return  blAssignm.assignmentUpdatesMissionStatus(assignment['id'], assignment['work_process_id'])
          .then(() => blAssignm.activateNextAssignmentInPipeline(assignment));

}


// Subscribe to database changes
function processAssignmentEvents(msg) {
    let payload = JSON.parse(msg.payload);
    let assignment_status;

    switch (msg.channel) {
            case 'assignments_status_update':
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                assignment_status = payload['status'];

                if(assignment_status == ASSIGNMENT_STATUS.TO_DISPATCH){
                    blAssignm.updateAssignmentContext(payload['id'])
                    .then(()=> blAssignm.dispatchAssignmentToAgent(payload))
                    .then(() => databaseServices.assignments.update('id', payload['id'], {status:ASSIGNMENT_STATUS.EXECUTING, start_time_stamp: new Date()}))
                    .catch(err => logData.addLog('helyos_core', null, 'error', `assignment ${payload['id']} ${assignment_status} ${err.message}`));
                }

                if(assignment_status == ASSIGNMENT_STATUS.CANCELING || assignment_status == 'cancelling'){
                    blAssignm.cancelAssignmentByAgent(payload)
                    .then(() => databaseServices.assignments.update('id', payload['id'], {status:ASSIGNMENT_STATUS.CANCELED}))
                    .catch(err => logData.addLog('helyos_core', null, 'error', `assignment ${payload['id']} ${assignment_status} ${err.message}`));
                }

                if(assignment_status == ASSIGNMENT_STATUS.SUCCEEDED){
                    databaseServices.assignments.update('id', payload['id'], {status:ASSIGNMENT_STATUS.COMPLETED})
                    .then(() =>  wrapUpAssignment(payload))
                    .catch(err => logData.addLog('helyos_core', null, 'error', `assignment ${payload['id']} ${assignment_status} ${err.message}`));
                }

                
                if(assignment_status == ASSIGNMENT_STATUS.CANCELED || assignment_status == 'cancelled'){
                    wrapUpAssignment(payload)
                    .catch(err => logData.addLog('helyos_core', null, 'error', `assignment ${payload['id']} ${assignment_status} ${err.message}`));
                }


                if(assignment_status == ASSIGNMENT_STATUS.FAILED ||  assignment_status == ASSIGNMENT_STATUS.ABORTED || assignment_status == ASSIGNMENT_STATUS.REJECTED){
                    logData.addLog('helyos_core', null, 'error', `assignment ${payload['id']} ${assignment_status}`);

                    databaseServices.work_processes.get_byId(payload['work_process_id'], ['id', 'on_assignment_failure'])
                    .then(wp => {

                        if (wp.on_assignment_failure === ON_ASSIGNMENT_FAILURE_ACTIONS.CONTINUE) {
                            wrapUpAssignment(payload);
                        }

                        if (wp.on_assignment_failure === ON_ASSIGNMENT_FAILURE_ACTIONS.RELEASE) {
                            wrapUpAssignment(payload)
	                        .then(()=> agentComm.sendReleaseFromWorkProcessRequest(payload['agent_id'], payload['work_process_id']));
                        }

                        if (wp.on_assignment_failure === ON_ASSIGNMENT_FAILURE_ACTIONS.FAIL) {
                            databaseServices.work_processes.updateByConditions({id: payload['work_process_id'], 
                                                            status__in: [   MISSION_STATUS.PREPARING,
                                                                            MISSION_STATUS.CALCULATING,
                                                                            MISSION_STATUS.EXECUTING
                                                                        ]},
                                                            {status: MISSION_STATUS.ASSIGNMENT_FAILED});
                        }

                    })
                    .catch(err => logData.addLog('helyos_core', null, 'error', `assignment ${payload['id']} ${assignment_status} ${err.message}`));
                                                    
                }

                break;

            case 'assignments_insertion':
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                assignment_status = payload['status'];
                if(assignment_status){  
                    if(assignment_status == ASSIGNMENT_STATUS.TO_DISPATCH){
                        blAssignm.dispatchAssignmentToAgent(payload);
                        databaseServices.assignments.update('id', payload['id'], {status:ASSIGNMENT_STATUS.EXECUTING})
                        .catch(err => logData.addLog('helyos_core', null, 'error', `assignment ${payload['id']} ${assignment_status} ${err.message}`));
                    }
                }
                break;

            default:

                break;
        }

}


module.exports.processAssignmentEvents = processAssignmentEvents;