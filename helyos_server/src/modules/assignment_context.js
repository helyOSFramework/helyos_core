const databaseServices = require('../services/database/database_services.js');

/*
	Assignment Context.
		- assignmentId: id of the assignment;
		
*/
function generateAssignmentDependencies(assigmentIds){
	return databaseServices.assignments.list_in('id', assigmentIds)
	.then( assignments => {
		const dependencies = assignments.map( assignment => ({assignmentId: assignment.id, status:assignment.status, result: assignment.result }));
		return dependencies;
	});
}



module.exports.generateAssignmentDependencies =  generateAssignmentDependencies;
