// What is being tested:
// The client API can send a non-persistent stream message to an agent and the
// message reaches the agent through the dedicated stream routing path.

process.env.TEST_NUMBER = 20;
console.log('starting test 20');

let helyosApplication;
let rabbitMQClient;

describe('20 Send agent stream message', () => {
    it('sends a stream message to the agent', async () => {
        helyosApplication = await getHelyOSClientInstance();
        rabbitMQClient = await getRabbitMQClientInstance();

        const payload = 'test-stream-message-body';
        const result = await helyosApplication.sendAgentStreamMessage(1, payload);

        expect(result.success).toEqual(true);

        const message = await rabbitMQClient.waitForStreamMessage(payload, 10000);
        expect(message.body).toEqual(payload);
    });
});
