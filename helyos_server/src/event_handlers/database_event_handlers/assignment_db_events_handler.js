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
function processAssignmentEvents(channel, payload) {
    let assignment_status;

    switch (channel) {
            case 'assignments_status_update':
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

                    databaseServices.work_processes.get_byId(payload['work_process_id'], ['id', 'on_assignment_failure', 'fallback_mission',
                                                                                           'yard_id', 'work_process_type_name', 'data'])
                    .then(wp => {

                        const defaultFailureAction = wp.on_assignment_failure;
                        const assignmentFailureAction = payload['on_assignment_failure'];

                        const defaultFallbackMission = wp.fallback_mission;
                        const assignmentFallbackMission = payload['fallback_mission'];

                        
                        let onAssignmentFailure = assignmentFailureAction && assignmentFailureAction !== ON_ASSIGNMENT_FAILURE_ACTIONS.DEFAULT
                                                ? assignmentFailureAction
                                                : defaultFailureAction;

                        let fallbackMission = assignmentFallbackMission && assignmentFallbackMission !== 'DEFAULT'
                                                ? assignmentFallbackMission
                                                : defaultFallbackMission;


                        if (onAssignmentFailure === ON_ASSIGNMENT_FAILURE_ACTIONS.CONTINUE) {
                            return wrapUpAssignment(payload);
                        }

                        if (onAssignmentFailure === ON_ASSIGNMENT_FAILURE_ACTIONS.RELEASE) {
                           return  wrapUpAssignment(payload)
	                        .then(() => agentComm.sendReleaseFromWorkProcessRequest(payload['agent_id'], payload['work_process_id']))
                            .then(() => {
                                if (fallbackMission) {
                                    logData.addLog('agent', {'agent_id': payload.agent_id}, 'normal', `fallback mission: ${fallbackMission}`)
                                    return databaseServices.assignments.get_byId(payload['id'])
                                    .then((assignment) => {
                                        const data = {...wp.data, 
                                                    '_failed_assignment':{ 
                                                                        'result': assignment.result,
                                                                        'context': assignment.context,
                                                                        'data': assignment.data,
                                                                        'work_process':{id: wp.id,
                                                                                        data: wp.data,
                                                                                        recipe: wp.work_process_type_name
                                                                                       }
                                                                         }
                                        };
                                        return databaseServices.work_processes.insert({data, 
                                                                                agent_ids: [assignment.agent_id],
                                                                                yard_id: wp.yard_id,
                                                                                work_process_type_name: fallbackMission,
                                                                                status: MISSION_STATUS.DISPATCHED
                                                                               })
                                        .then((wpId) => logData.addLog('agent', {'agent_id': assignment.agent_id}, 'normal', `fallback mission  dispatched`))
                                    })
                                }
                            });
                        }


                        if (onAssignmentFailure === ON_ASSIGNMENT_FAILURE_ACTIONS.FAIL) {
                            return databaseServices.work_processes.updateByConditions({id: payload['work_process_id'], 
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