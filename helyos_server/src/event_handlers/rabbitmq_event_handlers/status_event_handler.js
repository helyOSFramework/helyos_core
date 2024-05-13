
const databaseServices = require('../../services/database/database_services.js');
const { logData} = require('../..//modules/systemlog');
const { inMemDB } = require('../../services/in_mem_database/mem_database_service.js');
const { MISSION_STATUS, ASSIGNMENT_STATUS } = require('../../modules/data_models.js');


/* Update the assignmnet if it is not already marked as 'completed' or 'succeeded' */
/* The data is updated in the assignment table and in the agent table (under work process clearance) */
async function updateAgentMission(assignment, uuid = null) {
    if (!assignment) return;
    const assignment_status_obj = assignment.assignment_status ? assignment.assignment_status : assignment; //back compatibility
    const assignmentId = assignment_status_obj.id;
    if (!assignmentId) return;
    const assignmentStatus = assignment_status_obj.status;
    const assignmentResult = assignment_status_obj.result;

    const assmUpdate = { 'id': assignmentId, 'status': assignmentStatus, 'result': assignmentResult };
    const currentAssm = await databaseServices.assignments.get_byId(assignmentId, ['status', 'work_process_id']);

    if (currentAssm &&
        [ASSIGNMENT_STATUS.SUCCEEDED, ASSIGNMENT_STATUS.COMPLETED, ASSIGNMENT_STATUS.FAILED].includes(currentAssm.status)) {
        logData.addLog('agent', { 'uuid': uuid }, 'warning', `agent tried to change the status of an assignment that is already ${currentAssm.status}`);
        return;
    }

    if ([ASSIGNMENT_STATUS.CANCELED, ASSIGNMENT_STATUS.ABORTED, ASSIGNMENT_STATUS.FAILED].includes(assmUpdate.status)) {
        logData.addLog('agent', { 'uuid': uuid }, 'info', `agent has marked the assignment ${assignmentId} as ${assmUpdate.status}`);
        return await databaseServices.assignments.update_byId(assignmentId, assmUpdate);
    }

    await databaseServices.assignments.updateByConditions({
        'assignments.id': assignmentId,
        'work_processes.id': currentAssm.work_process_id,
        'work_processes.status__in': [  MISSION_STATUS.EXECUTING,
                                        MISSION_STATUS.DISPATCHED,
                                        MISSION_STATUS.CALCULATING,
                                        MISSION_STATUS.CANCELING,
                                        MISSION_STATUS.FAILED]
    }, assmUpdate);

    if (uuid) {
        const agents = await databaseServices.agents.get('uuid', uuid, ['id', 'wp_clearance']);
        if (agents.length > 0) {
            const agent = agents[0];
            if (agent.wp_clearance) agent.wp_clearance['assignment_status'] = assmUpdate;  //backward compatibility
            return await databaseServices.agents.update_byId(agent.id, { 'wp_clearance': agent.wp_clearance, 'assignment': assignment });
        } else {
            logData.addLog('agent', { uuid }, 'error', "agent does not exist");
        }
    }
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
            return updateAgentMission(objMsg.body.assignment, uuid);
        }

    } catch (error) {
        console.error(error);
        databaseServices.agents.update('uuid', uuid, {status:objMsg.body.status});
        return updateAgentMission(objMsg.body.wp_clearance, uuid);

    }
}


module.exports.updateState = updateState;
module.exports.updateAgentMission = updateAgentMission;
