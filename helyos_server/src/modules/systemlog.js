// This module is used to collect logs and save then in the database.

const databaseServices = require('../services/database/database_services.js')
const LOG_OUTPUT = process.env.LOG_OUTPUT || 'database';


/** 
 * Class that gather 10 log messsage and insert than with a single INSERT query to the database.
 * @class
 * @param {string} origin - The origin of the log message. It can be 'microservice', 'helyos_core' or 'agent'.
 * @param {object} metadata - The metadata of the log message. It can be the request object, the agent object or the assignment object.
 * @param {string} logType - The type of the log message. It can be 'info', 'warning' or 'error'.
 * 
 * @param {string} log_msg - The log message.
 * @param {string} eventType - The event type of the log message. It can be 'request', 'response', 'error', 'info', 'warning' or 'success'.
 * 
 * 
    */

class LogData {
    constructor(number_of_logs=10) {
        this.number_of_logs = number_of_logs;
        this.logs = [];
        this._periodicallySaveLogs();
    
    }

    addLog(origin, metadata, logType, log_msg, eventType='') {
        let new_log_instance = parseLogData(origin, metadata, logType, log_msg, eventType);
        if (LOG_OUTPUT === 'database') {
            this.logs.push(new_log_instance);
            if (this.logs.length >= this.number_of_logs) {
                this.saveLogs();
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
        }, 1000);
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
            if (metadata.tool_uuid){   // Deprecated
                hac_data.uuid = metadata.tool_uuid; // Deprecated
            }

            if (metadata.agent_uuid){
                hac_data.uuid = metadata.agent_uuid;
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