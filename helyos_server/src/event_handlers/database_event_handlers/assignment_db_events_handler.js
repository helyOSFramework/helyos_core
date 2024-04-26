// ----------------------------------------------------------------------------
// Postgress notification pipeline setup :  Postgres -> Nodejs -> (Front-end socket or Message Broker or Ext. Service)
// ----------------------------------------------------------------------------

// The microservices produces one or more assignments.
// The assignments are sent to the agents.


const blAssignm = require('../../modules/assignment_orchestration.js')
const databaseServices = require('../../services/database/database_services.js')
const webSocketCommunicaton = require('../../modules/communication/web_socket_communication.js');
const { logData } = require('../../modules/systemlog.js');
const {ASSIGNMENT_STATUS, MISSION_STATUS} = require('../../modules/data_models.js');
const bufferNotifications = webSocketCommunicaton.bufferNotifications;


// Subscribe to database changes
function processAssignmentEvents(msg) {
    let payload = JSON.parse(msg.payload);

    switch (msg.channel) {
            case 'assignments_status_update':
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                assignment_status = payload['status'];

                if(assignment_status == ASSIGNMENT_STATUS.SUCCEEDED){
                    databaseServices.assignments.update('id', payload['id'], {status:ASSIGNMENT_STATUS.COMPLETED})
                    .then(() =>  {
                        blAssignm.assignmentUpdatesMissionStatus(payload['id'], payload['work_process_id']);
                        blAssignm.activateNextAssignmentInPipeline(payload); // Next assignment status: not_ready_for_dispatch => wait_dependencies/to_dispatch
                    });
                }
                if(assignment_status == ASSIGNMENT_STATUS.CANCELING || assignment_status == 'cancelling'){
                    blAssignm.cancelAssignmentByAgent(payload)
                    .then(() => databaseServices.assignments.update('id', payload['id'], {status:ASSIGNMENT_STATUS.CANCELED}));
                }
                if(assignment_status == ASSIGNMENT_STATUS.CANCELED || assignment_status == 'cancelled'){
                    blAssignm.assignmentUpdatesMissionStatus(payload['id'], payload['work_process_id']);
                    blAssignm.activateNextAssignmentInPipeline(payload);
                }
                if(assignment_status == ASSIGNMENT_STATUS.TO_DISPATCH){
                    blAssignm.updateAssignmentContext(payload['id'])
                    .then(()=> blAssignm.dispatchAssignmentToAgent(payload))
                    .then(() => databaseServices.assignments.update('id', payload['id'], {status:ASSIGNMENT_STATUS.EXECUTING, start_time_stamp: new Date()}));
                }

                if(assignment_status == ASSIGNMENT_STATUS.FAILED ||  assignment_status == ASSIGNMENT_STATUS.ABORTED || assignment_status == ASSIGNMENT_STATUS.REJECTED){
                    logData.addLog('helyos_core', null, 'error', `assignment ${payload['id']} ${assignment_status}`);

                    databaseServices.work_processes.updateByConditions({id: payload['work_process_id'], 
                                                                        status__in: [   MISSION_STATUS.PREPARING,
                                                                                        MISSION_STATUS.CALCULATING,
                                                                                        MISSION_STATUS.EXECUTING
                                                                                    ]},
                                                                        {status: MISSION_STATUS.ASSIGNMENT_FAILED});
                }

                break;

            case 'assignments_insertion':
                bufferNotifications.pushNotificationToFrontEnd(msg.channel, payload);
                assignment_status = payload['status'];
                if(assignment_status){  
                    if(assignment_status == ASSIGNMENT_STATUS.TO_DISPATCH){
                        blAssignm.dispatchAssignmentToAgent(payload);
                        databaseServices.assignments.update('id', payload['id'], {status:ASSIGNMENT_STATUS.EXECUTING})
                    }
                }
                break;

            default:

                break;
        }

}


module.exports.processAssignmentEvents = processAssignmentEvents;