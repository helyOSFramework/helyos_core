const databaseServices = require('../services/database/database_services.js');

/** 
* generateAssignmentDependencies
* @param {Array} assigmentIds - The ids of the assignments to be processed.
* @returns {Promise}
* @description
* This function maps the output (result) of the assignment dependencies (previous completed assigement of the missions).
*
*/
function generateAssignmentDependencies(assignment) {
	const assignmentIds = assignment.depend_on_assignments;
	return databaseServices.assignments.list_in('id', assignmentIds)
		.then(assignments => {
			const dependencies = assignments.map(assign => ({ assign: assignment.id, status: assign.status, result: assign.result }));
			return dependencies;
		});
}



module.exports.generateAssignmentDependencies = generateAssignmentDependencies;
