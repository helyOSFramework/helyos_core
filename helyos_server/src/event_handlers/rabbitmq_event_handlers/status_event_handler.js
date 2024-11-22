
const databaseServices = require('../../services/database/database_services.js');
const { logData} = require('../..//modules/systemlog');
const memDBService = require('../../services/in_mem_database/mem_database_service.js');
const { MISSION_STATUS, ASSIGNMENT_STATUS } = require('../../modules/data_models.js');


/**
 * Evaluates the updates for an assignment's status based on its current status and the parent mission's status.
 * 
 * @param {Object} currentAssm - The current state of the assignment.
 * @param {Object} assmUpdate - The proposed updates to the assignment.
 * @returns {Promise} A promise which resolves when the assignment update has been handled appropriately.
 */
const evaluateAssignmentUpdate = (currentAssm, assmUpdate, uuid) => {
    // If assignment status changed
    if (currentAssm.status !== assmUpdate.status) {
        // Filtering out irrelevant state update
        if(currentAssm.status === ASSIGNMENT_STATUS.COMPLETED && assmUpdate.status === ASSIGNMENT_STATUS.SUCCEEDED) {
            return Promise.resolve(false);
        }
        // Filtering out and reportig invalid state flow
        if ([ASSIGNMENT_STATUS.SUCCEEDED, ASSIGNMENT_STATUS.COMPLETED, ASSIGNMENT_STATUS.FAILED].includes(currentAssm.status)){
            logData.addLog('agent', { 'uuid': uuid }, 'warning', `agent tried to change the status of an assignment that is already ${currentAssm.status}`);
            return Promise.resolve(false);
        }
        // Unconditonaly ending an assignment
        if ([ASSIGNMENT_STATUS.CANCELED, ASSIGNMENT_STATUS.ABORTED, ASSIGNMENT_STATUS.FAILED].includes(assmUpdate.status)) {
            logData.addLog('agent', { 'uuid': uuid }, 'info', `agent has marked the assignment ${currentAssm.id} as ${assmUpdate.status}`);
            return  databaseServices.assignments.update_byId(currentAssm.id, assmUpdate).then(()=>true);
        }
        // Conditional  assignment status change
        return databaseServices.assignments.updateByConditions({
            'assignments.id': currentAssm.id,
            'work_processes.id': currentAssm.work_process_id,
            'work_processes.status__in': [  MISSION_STATUS.EXECUTING,
                                            MISSION_STATUS.DISPATCHED,
                                            MISSION_STATUS.CALCULATING,
                                            MISSION_STATUS.CANCELING,
                                            MISSION_STATUS.FAILED]
            }, assmUpdate).then(()=>true);
    }

    // If assignment status did not change, but assignment results did.
    if (assmUpdate.status === ASSIGNMENT_STATUS.ACTIVE || assmUpdate.status === ASSIGNMENT_STATUS.EXECUTING) {
        // Conditional assignment status change
        return  databaseServices.assignments.updateByConditions({
            'assignments.id': currentAssm.id,
            'work_processes.id': currentAssm.work_process_id,
            'work_processes.status__in': [  MISSION_STATUS.EXECUTING,
                                            MISSION_STATUS.DISPATCHED,
                                            MISSION_STATUS.CALCULATING,
                                            MISSION_STATUS.CANCELING,
                                            MISSION_STATUS.FAILED]
            }, assmUpdate).then(()=>true);
    }

}

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
    const currentAssm = await databaseServices.assignments.get_byId(assignmentId, ['id', 'status', 'work_process_id']);
    if (!currentAssm) return;

    if (await evaluateAssignmentUpdate(currentAssm, assmUpdate, uuid)) {
        if (uuid) {
            const updtedAssignment = {...currentAssm, ...assmUpdate};
            await databaseServices.agents.updateByConditions({uuid}, {assignment:updtedAssignment});
        }
    }

}



async function updateState(objMsg, uuid, bufferPeriod=0) {
    try {
        const agentUpdate = {uuid, "status": objMsg.body.status, 'last_message_time': new Date() };
        const inMemDB = await memDBService.getInstance();

        // Get the agent id only once and save in local in-memory table.
        const agentInMem = await inMemDB.agents[uuid];
        if (!agentInMem || !agentInMem.id ){
            const ids = await databaseServices.agents.getIds([uuid]);
            inMemDB.update('agents', 'uuid', {uuid, id:ids[0]}, agentUpdate['last_message_time']);
            console.log(`Database query: agent ${uuid} has ID = ${ids[0]}`);

        }

        if (objMsg.body.resources){
            agentUpdate['resources'] = objMsg.body.resources;
        }

        inMemDB.agents_stats[uuid]['updtPerSecond'].countMessage();
        await databaseServices.agents.updateByConditions({uuid}, agentUpdate);
        
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