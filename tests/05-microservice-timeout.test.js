
// What is being tested:
// Creation of work process triggers creation of agent reserve request
// Agent clearance trigger the creation and dispatch of request to an external service.
// HelyOS core waits the mock server response until timeout.

process.env.TEST_NUMBER = 5;
console.log("starting test 5");


let helosClientApplication;

describe('05 Test Microservice Timeout',   () =>  {

    it('Agent is reserved', async () => {
        helosClientApplication = await setHelyOSClientInstance();
        await helosClientApplication.createNewMission();
        const result = await helosClientApplication.waitAgentStatus(1, 'ready');
        expect(result).toEqual(true);
    });

    it('Microservice is calculating', async () => {
        const result =  await helosClientApplication.waitMicroserviceStatus(1, 'pending');
        expect(result).toEqual(true);
    });

    it('Calculation is canceled by timeout', async () => {
        const result =  await helosClientApplication.waitMicroserviceStatus(1, 'canceled');
        expect(result).toEqual(true);
    });


    it('Agent is released free', async () => {
        const result = await helosClientApplication.waitAgentStatus(1, 'free');
        expect(result).toEqual(true);
    });


    it('Mission is marked as failed', async () => {
        const result = await helosClientApplication.waitMissionStatus(1, 'failed');
        expect(result).toEqual(true);
    });

    

  });