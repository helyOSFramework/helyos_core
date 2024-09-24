// This module is used to collect logs and save them in the database.

const databaseServices = require('../services/database/database_services.js')
const LOG_OUTPUT = process.env.LOG_OUTPUT || 'database';


/**
 * LogData gathers messages and inserts them with a single INSERT query to the database after a time period.
 * @class
 */
class LogData {
    /**
     * Creates a new LogData instance.
     * @param {number} [bufferTime=1000] - The time interval (in milliseconds) for periodically saving logs to the database.
     */
    constructor(bufferTime=1000) {
        this.logs = [];
        this._periodicallySaveLogs();
        this.lastLogMsg = '';
        this.repeatedLog = 1;
        this.bufferTime = bufferTime;
    }
  
    isLogRepeating(lastLog, newLog) {
        return  lastLog.event == newLog.event &&
                lastLog.log_type == newLog.log_type &&
                lastLog.origin == newLog.origin &&
                this.lastLogMsg == newLog.msg;
    }
   /**
    * Adds a log entry to the internal log buffer.
    * @param {string} origin - The origin of the log message (e.g., 'microservice', 'helyos_core', or 'agent').
    * @param {object} metadata - The metadata associated with the log message (e.g., request object, agent object, or assignment object).
    * @param {string} logType - The type of the log message ('info', 'warning', or 'error').
    * @param {string} log_msg - The log message.
    * @param {string} [eventType=''] - The event type of the log message ('request', 'response', 'error', 'info', 'warning', or 'success').
    */
    addLog(origin, metadata, logType, log_msg, eventType='') {
        let new_log_instance = parseLogData(origin, metadata, logType, log_msg, eventType);
        if (LOG_OUTPUT === 'database') {
            const lastLog = this.logs[this.logs.length - 1];
            if (lastLog && this.isLogRepeating(lastLog, new_log_instance)) {
                    this.repeatedLog++;
                    lastLog.msg = `${this.repeatedLog}X: ${log_msg}`;
                } else {
                    this.lastLogMsg = log_msg;
                    this.repeatedLog = 1;
                    this.logs.push(new_log_instance);
                }
        } else {
            console.log(new_log_instance);
        }
    }

    saveLogs(force=false) {
        if (this.logs.length && (this.logs.length > 0 || force)) {
            databaseServices.sysLogs.insertMany(this.logs)
            .catch(err => {console.error(err) });
            this.logs = [];
        }
    }

    _periodicallySaveLogs() {
        setInterval(() => {
            this.saveLogs(true);
        }, this.bufferTime);
    }
}



function parseLogData(origin, metadata, logType, log_msg, eventType='' ) {
    let new_log_instance;
    let wproc_id = null;
    if (typeof log_msg !== 'string') {
        log_msg = JSON.stringify(log_msg);
    }

    switch (origin) {
        case 'microservice':
            const servRequest = metadata;
            let service_url = '';
            let service_type = '';
            if (servRequest) {
                service_url = servRequest.service_url;
                wproc_id =  servRequest.work_process_id;
                service_type:  servRequest.service_type
            }

            new_log_instance = { 
                                event: eventType,
                                origin: origin,
                                wproc_id:  wproc_id,
                                service_type:  service_type,
                                agent_uuid: null,
                                log_type: logType,
                                msg: service_url?  `${service_url}- ${log_msg}` : log_msg
                                };
            break;

        case 'helyos_core':
            if(!metadata) metadata={};
            new_log_instance = { 
                                event: eventType,
                                origin: origin,
                                wproc_id:  metadata.wproc_id,
                                service_type:  '',
                                agent_uuid: null,
                                log_type: logType,
                                msg: log_msg
                                };
            break;

        case 'agent':
            const hac_data = metadata;
            let agent_name = '';
            
            // if metadata is hac_data
            if(metadata.body && metadata.body.wp_clearance){
                wproc_id =  metadata.body.wp_clearance.wp_id;
            }
            if(metadata.body && metadata.body.resources){
                wproc_id =  metadata.body.resources.work_process_id;
            }
            if(metadata.body && metadata.body.name){
                agent_name =  metadata.body.name;
            }
     
            // if metadata is agent
            if(metadata.name){
                agent_name =  metadata.name;
            }

            // if metadata is assignment
            if (metadata.work_process_id){
                wproc_id = metadata.work_process_id;
            }

            // if metadata is instant action  

            if (metadata.agent_uuid || metadata.agentUuid ){
                hac_data.uuid = metadata.agent_uuid || metadata.agentUuid;
            }

            new_log_instance = { 
                                event: eventType,
                                origin: origin,
                                wproc_id:  wproc_id,
                                agent_uuid: hac_data.uuid,
                                log_type: logType,
                                msg: agent_name? `${agent_name}- ${log_msg}` : log_msg
                                };
            break;

        default:
            break;
    }

    return new_log_instance;

}

const logData = new LogData();


module.exports.parseLogData = parseLogData;
module.exports.logData = logData;