
// What is being tested:
// Same than test 01 but the mission request is originated by an agent via RabbitMQ, not by http request from the app.
//

process.env.TEST_NUMBER = 7;
console.log("starting test 7");


let helyosApplication, rabbitMQClient;

describe('07 Agent Request Mission',   () =>  {

    it('One Agent requests the mission and another Agent is reserved', async () => {
        helyosApplication = await getHelyOSClientInstance();
        rabbitMQClient = await getRabbitMQClientInstance();

        await rabbitMQClient.sendMissionRequest();
        const result = await helyosApplication.waitAgentStatus(1, 'ready');
        expect(result).toEqual(true);
    });

    it('Mission is marked as calculating', async () => {
        const result = await helyosApplication.waitMissionStatus(1, 'calculating');
        expect(result).toEqual(true);
    });

    it('One microservice request was created', async () => {
        const result =  await helyosApplication.listServiceRequests();
        expect(result.length).toEqual(1);
    });

    it('Microservice result is pending', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'pending');
        expect(result).toEqual(true);
    });

    it('Microservice is ready', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'ready');
        expect(result).toEqual(true);
    });

    it('Agent is busy', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'busy');
        expect(result).toEqual(true);
    });

    it('Mission is marked as finished', async () => {
        const result = await helyosApplication.waitMissionStatus(1, 'succeeded');
        expect(result).toEqual(true);
    });

    it('Agent is free', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'free');
        expect(result).toEqual(true);
    });

    

  });