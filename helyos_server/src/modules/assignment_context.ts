import databaseServices  from '../services/database/database_services';

interface Assignment {
    id: number;
    depend_on_assignments: number[];
    status: string;
    result: any;
}

interface AssignmentDependency {
    assign: number;
    status: string;
    result: any;
}

/**
 * Generates assignment dependencies by mapping the output (result) of the
 * assignment dependencies (previous completed assignments of the missions).
 *
 * @param assignment - The assignment containing dependency information
 * @returns Promise containing an array of assignment dependencies
 */
export async function generateAssignmentDependencies(
    assignment: Assignment
): Promise<AssignmentDependency[]> {
    const assignmentIds = assignment.depend_on_assignments;

    const assignments = await databaseServices.assignments.list_in('id', assignmentIds);

    return assignments.map(assign => ({
        assign: assignment.id,
        status: assign.status,
        result: assign.result,
    }));
}