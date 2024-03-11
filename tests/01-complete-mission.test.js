
// What is being tested:
// Creation of work process triggers creation of agent reserve request
// Agent clearance trigger the creation and dispatch of request to an external service.
// HelyOS core waits the mock server response.
// External service response trigger creation of assignment.
// Simulator executes the assignment and mark it as completed => agent becomes free.

process.env.TEST_NUMBER = 1;
console.log("starting test 1");

let helyosApplication;

describe('01 Test Complete Mission',   () =>  {

    it('Agent is reserved', async () => {
        helyosApplication = await getHelyOSClientInstance();
        await helyosApplication.createNewMission();
        const result = await helyosApplication.waitAgentStatus(1, 'ready');
        expect(result).toEqual(true);
    });

    it('Microservice is calculating', async () => {
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