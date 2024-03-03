// This module is used to collect logs and save then in the database.

const databaseServices = require('../services/database/database_services.js')


function saveLogData(origin, metadata, logType, log_msg, eventType='' ) {
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

    databaseServices.sysLogs.insert(new_log_instance);
    console.log(new_log_instance)

}



module.exports.saveLogData = saveLogData;