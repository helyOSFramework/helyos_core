// What is being tested:
// Same than test 01 but the mission is canceled by the app.
// User cancels the assignment and Agent becomes free.

process.env.TEST_NUMBER = 2;
console.log("starting test 2");


let helosClientApplication;

describe('02 Test Canceled Mission',   () =>  {

    it('Agent is reserved', async () => {
        helosClientApplication = await setHelyOSClientInstance();
        await helosClientApplication.createNewMission();
        const result = await helosClientApplication.waitAgentStatus(1, 'ready');
        expect(result).toEqual(true);
    });

    it('Microservice is ready', async () => {
        const result =  await helosClientApplication.waitMicroserviceStatus(1, 'ready');
        expect(result).toEqual(true);
    });

    it('Agent is busy', async () => {
        const result = await helosClientApplication.waitAgentStatus(1, 'busy');
        expect(result).toEqual(true);
    });

    it('Mission is canceled by app -> Agent must cancel assignment', async () => {
        await helosClientApplication.cancelMission(1);
        const result = await helosClientApplication.waitAssignmentStatus(1, 'canceled');
        expect(result).toEqual(true);
    });

    it('Assignment is canceled -> Mission is canceled', async () => {
        const result = await helosClientApplication.waitMissionStatus(1, 'canceled');
        expect(result).toEqual(true);
    });

    it('Agent is free', async () => {
        const result = await helosClientApplication.waitAgentStatus(1, 'free');
        expect(result).toEqual(true);
    });

    

  });