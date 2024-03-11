
// What is being tested:
// Creation of work process triggers creation of agent reserve request
// Agent clearance trigger the creation and dispatch of request to an external service.
// HelyOS core waits the mock server response until timeout.

process.env.TEST_NUMBER = 5;
console.log("starting test 5");


let helyosApplication;

describe('05 Test Microservice Timeout',   () =>  {

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

    it('Calculation is canceled by timeout', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'canceled');
        expect(result).toEqual(true);
    });


    it('Agent is released free', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'free');
        expect(result).toEqual(true);
    });


    it('Mission is marked as failed', async () => {
        const result = await helyosApplication.waitMissionStatus(1, 'failed');
        expect(result).toEqual(true);
    });

    

  });