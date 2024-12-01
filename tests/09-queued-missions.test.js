
// What is being tested:
// Creation of two work processes and ascribing them to a mission queue.
// Mission is started and helyOS run the mission 1 and then, mission 2. a
// Simulator executes the assignments from both missions and mark it as completed => agent becomes free.

process.env.TEST_NUMBER = 9;
console.log("starting test 9");

let helyosApplication;
let queueId;

describe('09 Queue Mission',   () =>  {

    it('Queue is running', async () => {
        helyosApplication = await getHelyOSClientInstance();
        queueId = await helyosApplication.createNewQueue();
        await helyosApplication.createMissionForQueue('driving', queueId, 1);
        await helyosApplication.createMissionForQueue('driving', queueId, 2);
        await helyosApplication.startQueue(queueId);

        const result = await helyosApplication.waitMissionQueueStatus(queueId, 'running');
        expect(result).toEqual('running');
    });

    it('Agent is reserved', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'ready');
        expect(result).toEqual('ready');
    });

    it('Microservice 1 is calculating', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'pending');
        expect(result).toEqual('pending');
    });

    it('Microservice 1 is ready', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'ready');
        expect(result).toEqual('ready');
    });

    it('Agent is busy', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'busy');
        expect(result).toEqual('busy');
    });

    it('Mission 1 is marked as finished', async () => {
        const result = await helyosApplication.waitMissionStatus(1, 'succeeded');
        expect(result).toEqual('succeeded');
    });

    it('Microservice 2 is calculating', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(2, 'pending');
        expect(result).toEqual('pending');
    });

    it('Microservice 2 is ready', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(2, 'ready');
        expect(result).toEqual('ready');
    });

    it('Agent is busy', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'busy');
        expect(result).toEqual('busy');
    });

    it('Mission 2 is marked as finished', async () => {
        const result = await helyosApplication.waitMissionStatus(2, 'succeeded');
        expect(result).toEqual('succeeded');
    });

    it('Agent is free', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'free');
        expect(result).toEqual('free');
    });

    it('Queue is stopped', async () => {
        const result = await helyosApplication.waitMissionQueueStatus(queueId, 'stopped');
        expect(result).toEqual('stopped');
    });

  });