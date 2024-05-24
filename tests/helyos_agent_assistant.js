const amqp = require('amqplib');
const RBMQ_HOST = process.env.RBMQ_HOST || 'localhost';
const RBMQ_PORT = process.env.RBMQ_PORT || 99999;
const UUID = 'ASSISTANT_AGENT';

class RabbitMQClient {
    constructor(host, port) {
        this.RBMQ_PORT = port
        this.RBMQ_HOST = host
        this.EXCHANGE_NAME = 'xchange_helyos.agents.ul';
        this.UUID = UUID;;
        this.MISSION_ROUTING_KEY = `agent.${this.UUID}.mission_req`;
        this.AGENT_STATE_KEY = `agent.${this.UUID}.state`;
        this.connection = null; 
    }

    async login(username, password) {
        try {
            // Create connection
            this.connection = await amqp.connect(`amqp://${username}:${password}@${this.RBMQ_HOST}:${this.RBMQ_PORT}`);

            this.connection.on('error', (err) => {
                if (err.message !== 'Connection closing') {
                    console.log('RabbitMQ connection closed');
                }
            });

        } catch (error) {
            console.error('Failed to connect to RabbitMQ:', error);
            throw error;
        }
    }

    async sendMissionRequest() {
        try {
            const channel = await this.connection.createChannel();
            const workProcesss = {
                agent_uuids: ["Ab34069fc5-fdgs-434b-b87e-f19c5435113"],
                yard_id: 1,
                work_process_type_name: 'driving',
                data: { "foo:": "bar", agent_id: 1 },
                status: 'dispatched',
            };
            const message = {
                type: 'work_process',
                body: workProcesss,
                uuid: this.UUID
            };

            const jsonMessage = JSON.stringify(message);
            channel.publish(this.EXCHANGE_NAME, this.MISSION_ROUTING_KEY, Buffer.from(jsonMessage), { userId: this.UUID });
            await channel.close();
            console.log('Message sent to RabbitMQ');
        } catch (error) {
            console.error('Failed to send mission request:', error);
            throw error;
        }
    }


    async sendInvalidStatusValue() {
        try {
            const channel = await this.connection.createChannel();
            const states = {
                status: 'invalid_status',
            };
            const message = {
                type: 'agent_state',
                body: workProcesss,
                uuid: this.UUID
            };

            const jsonMessage = JSON.stringify(message);
            channel.publish(this.EXCHANGE_NAME, this.AGENT_STATE_KEY, Buffer.from(jsonMessage), { userId: this.UUID });
            await channel.close();
            console.log('Message with invalid agent status sent to RabbitMQ');
        } catch (error) {
            console.error('Failed to send mission request:', error);
            throw error;
        }
    }

    async close() {
        try {
            await this.connection.close();
        } catch (error) {
            console.error('Failed to close connection:', error);
            throw error;
        }
    }

}

const rabbitMQClient = new RabbitMQClient(RBMQ_HOST, RBMQ_PORT);

module.exports = { rabbitMQClient };
