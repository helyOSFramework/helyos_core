import config from './config';
import rbmqServices, {DataChannel} from './services/message_broker/rabbitMQ_services';
import { logData } from './modules/systemlog';

const {
    PREFETCH_COUNT, TTL_VISUAL_MSG, TTL_STATE_MSG,
} = config;

const {
    AGENTS_UL_EXCHANGE, AGENTS_DL_EXCHANGE,
    ANONYMOUS_EXCHANGE, AGENTS_MQTT_EXCHANGE,
} = config;

const {
    CHECK_IN_QUEUE, AGENT_MISSION_QUEUE,
    AGENT_VISUALIZATION_QUEUE, AGENT_UPDATE_QUEUE,
    AGENT_STATE_QUEUE, SUMMARY_REQUESTS_QUEUE,
    YARD_VISUALIZATION_QUEUE,
} = config;

/*
configureRabbitMQSchema()
helyOS defines the topic exchanges and queues in the rabbitMQ schema.
*/
async function configureRabbitMQSchema(dataChannels: DataChannel[]): Promise<DataChannel[]> {
    const mainChannel = dataChannels[0];
    const secondaryChannel = dataChannels[1];
    await mainChannel.prefetch(PREFETCH_COUNT);
    await secondaryChannel.prefetch(PREFETCH_COUNT);

    console.log("===> Setting RabbitMQ Schema");
    // SET EXCHANGE ANONYMOUS TO RECEIVE/SEND MESSAGES FROM/TO AGENT
    await mainChannel.assertExchange(ANONYMOUS_EXCHANGE, 'topic', {
        durable: true,
    });
    await rbmqServices.assertOrSubstituteQueue(mainChannel, CHECK_IN_QUEUE, false, true);
    await mainChannel.bindQueue(CHECK_IN_QUEUE, ANONYMOUS_EXCHANGE, "*.*.checkin");

    // SET EXCHANGE "DOWN LINK" (DL) TO SEND MESSAGES TO AGENT
    await mainChannel.assertExchange(AGENTS_DL_EXCHANGE, 'topic', {
        durable: true,
    });

    // SET EXCHANGE "UP LINK" (UL) AND QUEUES TO RECEIVE MESSAGES FROM AGENT
    await mainChannel.assertExchange(AGENTS_UL_EXCHANGE, 'topic', {
        durable: true,
    });

    // SET EXCHANGE FOR "MQTT" AGENTS AND QUEUES TO RECEIVE AND SEND MESSAGES TO AGENT. No exchange is used for MQTT
    await mainChannel.assertExchange(AGENTS_MQTT_EXCHANGE, 'topic', {
        durable: true,
    });

    await rbmqServices.assertOrSubstituteQueue(mainChannel, AGENT_UPDATE_QUEUE, false, true, {
        "x-message-ttl": TTL_STATE_MSG,
    });
    await mainChannel.bindQueue(AGENT_UPDATE_QUEUE, AGENTS_UL_EXCHANGE, "agent.*.update");
    await mainChannel.bindQueue(AGENT_UPDATE_QUEUE, AGENTS_UL_EXCHANGE, "agent.*.fact_sheet");
    await mainChannel.bindQueue(AGENT_UPDATE_QUEUE, AGENTS_MQTT_EXCHANGE, "agent.*.update");
    await mainChannel.bindQueue(AGENT_UPDATE_QUEUE, AGENTS_MQTT_EXCHANGE, "agent.*.fact_sheet");

    await rbmqServices.assertOrSubstituteQueue(secondaryChannel, AGENT_VISUALIZATION_QUEUE, false, false, {
        "x-message-ttl": TTL_VISUAL_MSG,
    });
    await secondaryChannel.bindQueue(AGENT_VISUALIZATION_QUEUE, AGENTS_UL_EXCHANGE, "agent.*.visualization");
    await secondaryChannel.bindQueue(AGENT_VISUALIZATION_QUEUE, AGENTS_MQTT_EXCHANGE, "agent.*.visualization");

    await rbmqServices.assertOrSubstituteQueue(secondaryChannel, YARD_VISUALIZATION_QUEUE, false, false, {
        "x-message-ttl": TTL_VISUAL_MSG,
    });
    await secondaryChannel.bindQueue(YARD_VISUALIZATION_QUEUE, AGENTS_UL_EXCHANGE, "yard.*.visualization");
    await secondaryChannel.bindQueue(YARD_VISUALIZATION_QUEUE, AGENTS_MQTT_EXCHANGE, "yard.*.visualization");

    await rbmqServices.assertOrSubstituteQueue(mainChannel, AGENT_STATE_QUEUE, false, true, {
        "x-message-ttl": TTL_STATE_MSG,
    });
    await mainChannel.bindQueue(AGENT_STATE_QUEUE, AGENTS_UL_EXCHANGE, "agent.*.state");
    await mainChannel.bindQueue(AGENT_STATE_QUEUE, AGENTS_MQTT_EXCHANGE, "agent.*.state");

    await rbmqServices.assertOrSubstituteQueue(mainChannel, AGENT_MISSION_QUEUE, false, true);
    await mainChannel.bindQueue(AGENT_MISSION_QUEUE, AGENTS_UL_EXCHANGE, "agent.*.mission_req");
    await mainChannel.bindQueue(AGENT_MISSION_QUEUE, AGENTS_MQTT_EXCHANGE, "agent.*.mission_req");

    await mainChannel.bindQueue(CHECK_IN_QUEUE, AGENTS_UL_EXCHANGE, "agent.*.checkin");
    await mainChannel.bindQueue(CHECK_IN_QUEUE, AGENTS_MQTT_EXCHANGE, "agent.*.checkin");

    await rbmqServices.assertOrSubstituteQueue(mainChannel, SUMMARY_REQUESTS_QUEUE, false, true);
    await mainChannel.bindQueue(SUMMARY_REQUESTS_QUEUE, AGENTS_UL_EXCHANGE, "*.*.database_req");
    await mainChannel.bindQueue(SUMMARY_REQUESTS_QUEUE, AGENTS_UL_EXCHANGE, "*.*.summary_req");
    await mainChannel.bindQueue(SUMMARY_REQUESTS_QUEUE, AGENTS_UL_EXCHANGE, "*.*.summary");  // MAGPIE COMPATIBLE
    logData.addLog('helyos_core', null, 'success', `RabbitMQ exchange configurations concluded.`);

    return dataChannels;
}

export {
    configureRabbitMQSchema,
};