
const databaseServices = require('../../services/database/database_services.js');
const {saveLogData} = require('../..//modules/systemlog');
const { inMemDB } = require('../../services/in_mem_database/mem_database_service.js');
/* Update the assignmnet if it is not already marked as 'completed' or 'succeeded' */
/* The data is updated in the assignment table and in the agent table (under work process clearance) */
function updateAgentMission(assignment, uuid=null) {
    if (!assignment) return Promise.resolve();
    const assignment_status_obj = assignment.assignment_status?  assignment.assignment_status:assignment; //back compatibility
    const assignmentId = assignment_status_obj.id;
    let assignmentStatus = assignment_status_obj.status;
    const assignmentResult = assignment_status_obj.result; 


    if (assignmentId){
        const assignment_update = {'id':assignmentId, 'status':assignmentStatus, 'result':assignmentResult };

        return databaseServices.assignments.get_byId(assignmentId,['status'])
        .then( assm => { 
            if (assm && assm.status !== 'succeeded' && assm.status !== 'completed' ){
                return databaseServices.assignments.update_byId(assignment_update.id, assignment_update)
                .then(() => databaseServices.agents.get('uuid', uuid, ['id', 'wp_clearance']))
                .then(agents => {
                    if (!uuid) return;
                    if (agents.length == 0) { 
                        saveLogData('agent', {uuid}, 'error', "agent does not exist");
                        return;
                    }

                    const agent = agents[0];
                    if (agent.wp_clearance) agent.wp_clearance['assignment_status'] = assignment_update;  //backward compatibility

                    databaseServices.agents.update_byId(agent.id, {'wp_clearance': agent.wp_clearance, 'assignment': assignment})
                })
        
            } else {
                if (assignment_update.status!=='succeeded' && assignment_update.status !=='completed') {
                    saveLogData('agent', {'uuid':uuid}, 'warning', `agent is trying to change an assignment that is already completed`);
                }
            }
        });
    }
    return Promise.resolve();
}





async function updateState(objMsg, uuid, bufferPeriod=0) {
    try {

        // Get the agent id only once and save in in-memory table.
        if (!inMemDB.agents[uuid] || !inMemDB.agents[uuid].id ){
            const toolIds = await databaseServices.agents.getIds([uuid]);
            inMemDB.update('agents', 'uuid', {uuid, id:toolIds[0]}, toolUpdate['last_message_time']);
        }


        const toolUpdate = {uuid, "status": objMsg.body.status, 'last_message_time': new Date() };

        if (objMsg.body.resources){
            toolUpdate['resources'] = objMsg.body.resources;
        }

        inMemDB.update('agents','uuid', toolUpdate, toolUpdate.last_message_time, 'realtime');
        inMemDB.flush('agents', 'uuid', databaseServices.agents, bufferPeriod);
        
        if (objMsg.body.assignment){
            updateAgentMission(objMsg.body.assignment,  uuid);
        }

    } catch (error) {
        console.error(error);
        databaseServices.agents.update('uuid', uuid, {status:objMsg.body.status});
        updateAgentMission(objMsg.body.wp_clearance,  uuid);

    }
}


module.exports.updateState = updateState;
module.exports.updateAgentMission = updateAgentMission;
