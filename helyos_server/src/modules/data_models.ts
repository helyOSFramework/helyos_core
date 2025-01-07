/**
 * Actions to take on assignment failure.
 * @enum {string}
 * 
 * - FAIL: The system stops the current process and reports an error.
 * - CONTINUE: The system continues with the next steps despite the failure.
 * - RELEASE_FAILED: The system continue but releases the current agent and marks its assignment as failed.
 */
enum ON_ASSIGNMENT_FAILURE_ACTIONS {
    FAIL = 'FAIL_MISSION',
    CONTINUE = 'CONTINUE_MISSION',
    RELEASE = 'RELEASE_FAILED',
    DEFAULT = 'DEFAULT'
}


/**
 * Domains for the microservices.
 * @enum {string}
 * 
 * - ASSIGNMENT_PLANNER: Create assignments for agents.
 * - MAP_SERVER: Update map objects.
 * - STORAGE_SERVER: Send data to cloud.
 */
enum SERVICE_DOMAINS {
    ASSIGNMENT_PLANNER = 'Assignment planner',
    MAP_SERVER = 'Map server',
    STORAGE_SERVER = 'Storage server'
}

/**
 * Defines agent statuses.
 * @enum {string}
 * 
 * Usual cycle:
 * NOT_AUTOMATABLE => FREE => READY => BUSY => READY => FREE
 * 
 * helyOS core requests the change from FREE to READY with a `reserve` instant action, and from READY to FREE with a `release` instant action.
 * PENDING => TIMEOUT
 *
 */
enum AGENT_STATUS {
    NOT_AUTOMAT = 'not_automatable',
    FREE = 'free',
    READY = 'ready',
    BUSY = 'busy'
}

/**
 * Agent class types.
 */
enum AGENT_CLASS {
    VEHICLE = 'vehicle',
    ASSISTANT = 'assistant',
    TOOL = 'tool'
}



/**
 * Defines microservice statuses.
 * @enum {string}
 * 
 * Usual cycle:
 * NOT_READY => WAIT_DEPENDENCIES => READY_FOR_SERVICE => PENDING => READY
 * 
 * helyOS core is responsible for the transitions:
 * PENDING => TIMEOUT
 *
 */
enum SERVICE_STATUS {
    NOT_READY = 'not_ready_for_service',
    READY_FOR_SERVICE = 'ready_for_service',
    PENDING = 'pending',
    FAILED = 'failed',
    TIMEOUT = 'time-out',
    CANCELED = 'canceled',
    SKIPPED = 'skipped',
    READY = 'ready',
    WAIT_DEPENDENCIES = 'wait_dependencies',
    DISPATCHING_SERVICE = 'dispatching_service',
}

/**
 * Defines  assignment statuses.
 * @enum {string}
 * 
 * Usual cycle:
 * DRAFT => DISPATCHED => PREPARING => CALCULATING=> EXECUTING => ASSIGNMENTS_COMPLETED => SUCCEEDED
 * 
 * helyOS core is responsible for the transitions:
 * ASSIGNMENTS_COMPLETED => SUCCEEDED
 *
 */
enum MISSION_STATUS {
    DRAFT = 'draft',
    DISPATCHED = 'dispatched',
    PREPARING = 'preparing resources',
    CALCULATING = 'calculating',
    EXECUTING = 'executing',
    ASSIGNMENTS_COMPLETED = 'assignments_completed',
    SUCCEEDED = 'succeeded',
    ASSIGNMENT_FAILED = 'assignment_failed',
    PLANNING_FAILED = 'planning_failed',
    FAILED = 'failed',
    CANCELING = 'canceling',
    CANCELED = 'canceled'
}



/**
 * Defines  assignment statuses.
 * @enum {string}
 * 
 * Usual cycle:
 * TO_DISPATCH => EXECUTING => SUCCEEDED => COMPLETED
 * 
 * helyOS core is responsible for the transitions:
 * SUCCEEDED => COMPLETED
 * CANCELING => CANCELED
 *
 */
enum ASSIGNMENT_STATUS {
    TO_DISPATCH = 'to_dispatch',
    EXECUTING = 'executing',
    SUCCEEDED = 'succeeded',
    COMPLETED = 'completed',
    REJECTED = 'rejected',
    FAILED = 'failed',
    ABORTED = 'aborted',
    CANCELING = 'canceling',
    CANCELED = 'canceled',
    WAIT_DEPENDENCIES = 'wait_dependencies',
    NOT_READY_TO_DISPATCH = 'not_ready_to_dispatch',
    ACTIVE = 'active'
}

/**
 * Defines  mission queue statuses.
 * @enum {string}
 * 
 * Usual cycle:
 * RUN => RUNNING => STOPPED
 * helyOS core is responsible for the transitions.
 **/
enum MISSION_QUEUE_STATUS {
    RUN = 'run',
    RUNNING = 'running',
    STOPPED = 'stopped',
    CANCEL = 'cancel'
}

const UNCOMPLETE_ASSIGNM_STATUSES: string[] = ['to_dispatch', 'not_ready_to_dispatch', 'wait_dependencies', 'executing', 'active'];
const UNCOMPLETE_ASSIGNM_BEFORE_DISPATCH: string[] = ['to_dispatch', 'not_ready_to_dispatch', 'wait_dependencies'];
const UNCOMPLETE_ASSIGNM_AFTER_DISPATCH: string[] = ['executing', 'active'];
const UNCOMPLETE_MISSION_STATUS: string[] = [MISSION_STATUS.DRAFT, MISSION_STATUS.DISPATCHED, MISSION_STATUS.PREPARING, MISSION_STATUS.CANCELING, MISSION_STATUS.CALCULATING, MISSION_STATUS.EXECUTING];
const UNCOMPLETED_SERVICE_STATUS: string[] = [SERVICE_STATUS.DISPATCHING_SERVICE, SERVICE_STATUS.PENDING, SERVICE_STATUS.READY, SERVICE_STATUS.WAIT_DEPENDENCIES];

export {
    ON_ASSIGNMENT_FAILURE_ACTIONS,
    SERVICE_DOMAINS,
    AGENT_STATUS,
    AGENT_CLASS,
    SERVICE_STATUS,
    MISSION_STATUS,
    ASSIGNMENT_STATUS,
    MISSION_QUEUE_STATUS,
    UNCOMPLETE_ASSIGNM_STATUSES,
    UNCOMPLETE_ASSIGNM_BEFORE_DISPATCH,
    UNCOMPLETE_ASSIGNM_AFTER_DISPATCH,
    UNCOMPLETE_MISSION_STATUS,
    UNCOMPLETED_SERVICE_STATUS
};
