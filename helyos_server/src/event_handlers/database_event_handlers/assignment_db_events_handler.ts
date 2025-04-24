// ----------------------------------------------------------------------------
// Postgres notification pipeline setup :  Postgres -> Nodejs -> (Front-end socket or Message Broker or Ext. Service)
// ----------------------------------------------------------------------------

// The microservices produces one or more assignments.
// The assignments are sent to the agents.

import * as AssmOrchestrator from '../../modules/assignment_orchestration';
import * as DatabaseService from '../../services/database/database_services';
import agentComm from '../../modules/communication/agent_communication';

import { logData } from '../../modules/systemlog';
import { ASSIGNMENT_STATUS, MISSION_STATUS, ON_ASSIGNMENT_FAILURE_ACTIONS } from '../../modules/data_models';

type Assignment = {
  id: number;
  work_process_id: number;
  agent_id?: number;
  status: string;
  on_assignment_failure?: string;
  fallback_mission?: string;
  result?: any;
  context?: any;
  data?: any;
};

type WorkProcess = {
  id: string;
  on_assignment_failure: string;
  fallback_mission: string;
  yard_id: string;
  work_process_type_name: string;
  data: any;
};

async function wrapUpAssignment(assignment: Assignment): Promise<void> {
  await AssmOrchestrator.assignmentUpdatesMissionStatus(assignment.id, assignment.work_process_id);
  await AssmOrchestrator.activateNextAssignmentInPipeline(assignment);
}

// Subscribe to database changes
async function processAssignmentEvents(channel: string, payload: Assignment): Promise<void> {
  const databaseServices = await DatabaseService.getInstance();
  
  let assignment_status: ASSIGNMENT_STATUS | undefined = payload.status as ASSIGNMENT_STATUS;

  switch (channel) {
    case 'assignments_status_update':
      if (assignment_status === ASSIGNMENT_STATUS.TO_DISPATCH) {
        try {
          await AssmOrchestrator.updateAssignmentContext(payload.id);
          await AssmOrchestrator.dispatchAssignmentToAgent(payload);
          await databaseServices.assignments.update('id', payload.id, {
            status: ASSIGNMENT_STATUS.EXECUTING,
            start_time_stamp: new Date(),
          });
        } catch (err: any) {
          logData.addLog('helyos_core', null, 'error', `assignment ${payload.id} ${assignment_status} ${err?.message}`);
        }
      }

      if (assignment_status === ASSIGNMENT_STATUS.CANCELING || assignment_status === 'cancelling' as any) {
        try {
          await AssmOrchestrator.cancelAssignmentByAgent(payload);
          await databaseServices.assignments.update('id', payload.id, {
            status: ASSIGNMENT_STATUS.CANCELED,
          });
        } catch (err: any) {
          logData.addLog('helyos_core', null, 'error', `assignment ${payload.id} ${assignment_status} ${err?.message}`);
        }
      }

      if (assignment_status === ASSIGNMENT_STATUS.SUCCEEDED) {
        try {
          await databaseServices.assignments.update('id', payload.id, {
            status: ASSIGNMENT_STATUS.COMPLETED,
          });
          await wrapUpAssignment(payload);
        } catch (err: any) {
          logData.addLog('helyos_core', null, 'error', `assignment ${payload.id} ${assignment_status} ${err?.message}`);
        }
      }

      if (assignment_status === ASSIGNMENT_STATUS.CANCELED || assignment_status === 'cancelled' as any) {
        try {
          await wrapUpAssignment(payload);
        } catch (err: any) {
          logData.addLog('helyos_core', null, 'error', `assignment ${payload.id} ${assignment_status} ${err?.message}`);
        }
      }

      if ([ASSIGNMENT_STATUS.FAILED, ASSIGNMENT_STATUS.ABORTED, ASSIGNMENT_STATUS.REJECTED].includes(assignment_status)) {
        logData.addLog('helyos_core', null, 'error', `assignment ${payload.id} ${assignment_status}`);

        try {
          const wp: WorkProcess = await databaseServices.work_processes.get_byId(payload.work_process_id, [
            'id',
            'on_assignment_failure',
            'fallback_mission',
            'yard_id',
            'work_process_type_name',
            'data',
          ]);

          const defaultFailureAction = wp.on_assignment_failure;
          const assignmentFailureAction = payload.on_assignment_failure;

          const defaultFallbackMission = wp.fallback_mission;
          const assignmentFallbackMission = payload.fallback_mission;

          const onAssignmentFailure =
            assignmentFailureAction && (assignmentFailureAction !== ON_ASSIGNMENT_FAILURE_ACTIONS.DEFAULT)
              ? assignmentFailureAction
              : defaultFailureAction;

          const fallbackMission =
            assignmentFallbackMission && assignmentFallbackMission !== 'DEFAULT'
              ? assignmentFallbackMission
              : defaultFallbackMission;

          if (onAssignmentFailure === ON_ASSIGNMENT_FAILURE_ACTIONS.CONTINUE) {
            await wrapUpAssignment(payload);
          }

          if (onAssignmentFailure === ON_ASSIGNMENT_FAILURE_ACTIONS.RELEASE) {
            await wrapUpAssignment(payload);
            await agentComm.sendReleaseFromWorkProcessRequest(payload.agent_id!, payload.work_process_id);
            if (fallbackMission) {
              logData.addLog('agent', { agent_id: payload.agent_id }, 'info', `fallback mission: ${fallbackMission}`);
              const assignment = await databaseServices.assignments.get_byId(payload.id);
              const data = {
                ...wp.data,
                _failed_assignment: {
                  result: assignment.result,
                  context: assignment.context,
                  data: assignment.data,
                  work_process: {
                    id: wp.id,
                    data: wp.data,
                    recipe: wp.work_process_type_name,
                  },
                },
              };
              const wpId = await databaseServices.work_processes.insert({
                data,
                agent_ids: [assignment.agent_id],
                yard_id: wp.yard_id,
                work_process_type_name: fallbackMission,
                status: MISSION_STATUS.DISPATCHED,
              });
              logData.addLog('agent', { agent_id: assignment.agent_id }, 'info', `fallback mission dispatched`);
            }
          }

          if (onAssignmentFailure === ON_ASSIGNMENT_FAILURE_ACTIONS.FAIL) {
            await databaseServices.work_processes.updateByConditions(
              {
                id: payload.work_process_id,
                status__in: [
                  MISSION_STATUS.PREPARING,
                  MISSION_STATUS.CALCULATING,
                  MISSION_STATUS.EXECUTING,
                ],
              },
              { status: MISSION_STATUS.ASSIGNMENT_FAILED },
            );
          }
        } catch (err: any) {
          logData.addLog('helyos_core', null, 'error', `assignment ${payload.id} ${assignment_status} ${err?.message}`);
        }
      }
      break;

    case 'assignments_insertion':
      if (assignment_status === ASSIGNMENT_STATUS.TO_DISPATCH) {
        try {
          await AssmOrchestrator.dispatchAssignmentToAgent(payload);
          await databaseServices.assignments.update('id', payload.id, {
            status: ASSIGNMENT_STATUS.EXECUTING,
          });
        } catch (err: any) {
          logData.addLog('helyos_core', null, 'error', `assignment ${payload.id} ${assignment_status} ${err?.message}`);
        }
      }
      break;

    default:
      break;
  }
}

export { processAssignmentEvents };
