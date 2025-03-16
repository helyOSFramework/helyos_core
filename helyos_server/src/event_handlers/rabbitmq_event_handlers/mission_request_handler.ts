import * as DatabaseService  from '../../services/database/database_services';
import * as memDBService from '../../services/in_mem_database/mem_database_service';
import rabbitMQServices from '../../services/message_broker/rabbitMQ_services';
import { logData } from '../../modules/systemlog';
import { MISSION_STATUS } from '../../modules/data_models';


interface WorkProcess {
    id: number;
    mission_queue_id: number;
    run_order: number;
    yard_id: number;
    yard_uid: string;
    work_process_type_id: number;
    status: string;
    work_process_type_name: string;
    description: string;
    data: any;
    tools_uuids: string[];
    agent_ids: number[];
    agent_uuids: string[];
} 
    

interface ObjMsg {
    body: Partial<WorkProcess>;
}

interface MsgProps {
    replyTo?: string;
    correlationId?: string;
}




async function requestMission(uuid: string, objMsg: ObjMsg, msgProps: MsgProps): Promise<number> {
    const databaseServices = await DatabaseService.getInstance();
    const inMemDB = await memDBService.getInstance();

    if (inMemDB.agents_stats[uuid]) {
        inMemDB.countMessages('agents_stats', uuid, 'updtPerSecond');
    }
    
    let replyTo = msgProps.replyTo ? msgProps.replyTo : uuid;
    let response, message;
    try {
        const wpId = await databaseServices.work_processes.insert({ ...objMsg.body, ...{ status: MISSION_STATUS.DISPATCHED } });
        logData.addLog('agent', { uuid, work_process_id: wpId }, 'info', `Agent requested a mission. WPID: ${wpId}`);
        response = {work_process_id: parseInt(wpId) };
    }
    catch (e) {
        logData.addLog('agent', {uuid}, 'error', `agent create mission=${e}`);
        response = {"error": JSON.stringify(e, Object.getOwnPropertyNames(e))};    
    }

    message = JSON.stringify(response);
    rabbitMQServices.sendEncryptedMsg(replyTo, message, '', '', '', msgProps.correlationId);
    return 0;
        
}

export  {requestMission};