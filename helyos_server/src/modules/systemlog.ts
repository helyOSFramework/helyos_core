import databaseServices from '../services/database/database_services';
const LOG_BUFFER_TIME = parseInt(process.env.LOG_BUFFER_TIME || '1000');
const LOG_OUTPUT = process.env.LOG_OUTPUT || 'database';

interface LogInstance {
    event?: string;
    origin: 'microservice' | 'helyos_core' | 'agent';
    wproc_id: number | null;
    service_type?: string;
    agent_uuid: string | null;
    log_type: 'info' | 'warn' | 'error' | 'success';
    msg: string;
}

interface ServiceRequest {
    service_url?: string;
    work_process_id?: number;
    service_type?: string;
}

interface AgentData {
    uuid?: string;
    body?: {
        wp_clearance?: {
            wp_id: number;
        };
        resources?: {
            work_process_id: number;
        };
        name?: string;
    };
    name?: string;
    work_process_id?: number;
    agent_uuid?: string;
    agentUuid?: string;
}

type LogType = 'info' | 'warn' | 'error' | 'success';
type LogOrigin = 'microservice' | 'helyos_core' | 'agent' | 'work_process';

/**
 * LogData gathers messages and inserts them with a single INSERT query to the database after a time period.
 */
class LogData {
    private logs: LogInstance[] = [];
    private lastLogMsg: string;
    private repeatedLog: number;
    private bufferTime: number;
    private interval: NodeJS.Timer;

    /**
     * Creates a new LogData instance.
     * @param bufferTime - The time interval (in milliseconds) for periodically saving logs to the database.
     */
    constructor(bufferTime: number = 1000) {
        this.logs = [];
        this.lastLogMsg = '';
        this.repeatedLog = 1;
        this.bufferTime = bufferTime;
        if (bufferTime > 0){
            this.interval = this._periodicallySaveLogs();
        }
    }

    private isLogRepeating(lastLog: LogInstance, newLog: LogInstance): boolean {
        return lastLog.event === newLog.event &&
            lastLog.log_type === newLog.log_type &&
            lastLog.origin === newLog.origin &&
            this.lastLogMsg === newLog.msg;
    }

    /**
     * Adds a log entry to the internal log buffer.
     * @param {string} origin - The origin of the log message (e.g., 'microservice', 'helyos_core', or 'agent').
     * @param {object} metadata - The metadata associated with the log message (e.g., request object, agent object, or assignment object).
     * @param {string} logType - The type of the log message ('info', 'warn', or 'error').
     * @param {string} log_msg - The log message.
     */
    public addLog(
        origin: LogOrigin,
        metadata: ServiceRequest | AgentData | Record<string, any> | null,
        logType: LogType,
        logMsg: string,
        stdOutOnly: boolean = false
    ): void {
        const now = new Date();
        const formattedDate = now.toISOString();

        const colorLog = (type: LogType, message: string): void => {
            const colors = {
                info: '\x1b[0m',    // Default
                success: '\x1b[32m', // Green
                warn: '\x1b[33m',    // Yellow
                error: '\x1b[31m',   // Red
                reset: '\x1b[0m',     // Reset
            };

            const color = colors[type] || colors.reset;
            console.log(`${color}[${type.toUpperCase()}] ${message}${colors.reset}`);
        };

        colorLog(logType, `${formattedDate}: ${logMsg}`);
        if (stdOutOnly) {
            return;
        }

        const newLogInstance = parseLogData(origin, metadata, logType, logMsg);
        if (LOG_OUTPUT === 'database' && newLogInstance) {
            const lastLog = this.logs[this.logs.length - 1];
            if (lastLog && this.isLogRepeating(lastLog, newLogInstance)) {
                this.repeatedLog++;
                lastLog.msg = `${this.repeatedLog}X: ${logMsg}`;
            } else {
                this.lastLogMsg = logMsg;
                this.repeatedLog = 1;
                this.logs.push(newLogInstance);
            }
        } else if (newLogInstance) {
            console.log(newLogInstance);
        }

        if (this.bufferTime === 0) {
            const _logs = [...this.logs];
            this.logs = [];
            this.saveLogs(_logs);
        }
    }

    public async saveLogs(logs:any[]): Promise<void> {
        if (logs.length && (logs.length > 0)) {
            try {
                await databaseServices.sysLogs.insertMany(logs);
            } catch (err) {
                console.error(err);
            }
        }
    }

    private _periodicallySaveLogs(): NodeJS.Timer {
        return setInterval(() => {
            const _logs = [...this.logs];
            this.logs = [];
            this.saveLogs(_logs);
        }, this.bufferTime);
    }
}

function parseLogData(
    origin: LogOrigin,
    metadata: ServiceRequest | AgentData | Record<string, any> | null,
    logType: LogType,
    logMsg: string
): LogInstance | null {
    let newLogInstance: LogInstance | null = null;
    let wprocId: number | null = null;

    const finalLogMsg = typeof logMsg !== 'string' ? JSON.stringify(logMsg) : logMsg;

    switch (origin) {
        case 'microservice': {
            const servRequest = metadata as ServiceRequest;
            const serviceUrl = servRequest.service_url || '';
            wprocId = servRequest.work_process_id || null;
            const serviceType = servRequest.service_type || '';

            newLogInstance = {
                origin,
                wproc_id: wprocId,
                service_type: serviceType,
                agent_uuid: null,
                log_type: logType,
                msg: serviceUrl ? `${serviceUrl}- ${finalLogMsg}` : finalLogMsg,
            };
            break;
        }

        case 'helyos_core': {
            const meta = metadata as Record<string, any> || {};
            newLogInstance = {
                origin,
                wproc_id: meta.wproc_id || null,
                service_type: '',
                agent_uuid: null,
                log_type: logType,
                msg: finalLogMsg,
            };
            break;
        }

        case 'agent': {
            const hacData = metadata as AgentData;
            let agentName = '';

            // Check different metadata structures
            if (hacData.body?.wp_clearance) {
                wprocId = hacData.body.wp_clearance.wp_id;
            }
            if (hacData.body?.resources) {
                wprocId = hacData.body.resources.work_process_id;
            }
            if (hacData.body?.name) {
                agentName = hacData.body.name;
            }
            if (hacData.name) {
                agentName = hacData.name;
            }
            if (hacData.work_process_id) {
                wprocId = hacData.work_process_id;
            }
            if (hacData.agent_uuid || hacData.agentUuid) {
                hacData.uuid = hacData.agent_uuid || hacData.agentUuid;
            }

            newLogInstance = {
                origin,
                wproc_id: wprocId,
                agent_uuid: hacData.uuid || null,
                log_type: logType,
                msg: agentName ? `${agentName}- ${finalLogMsg}` : finalLogMsg,
            };
            break;
        }
        default:
            break;
    }

    return newLogInstance;
}

const logData = new LogData(LOG_BUFFER_TIME);

export {
    LogData, logData, parseLogData, LogInstance, LogType, LogOrigin,
};