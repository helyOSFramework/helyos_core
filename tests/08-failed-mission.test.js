// What is being tested:
// Same than test 01 but the mission will failed because microservice produces wrong
// assignment format.


process.env.TEST_NUMBER = 8;
console.log("starting test 8");


let helyosApplication;

describe('08 Test Failed Mission',   () =>  {

    it('Agent is reserved', async () => {
        helyosApplication = await getHelyOSClientInstance();
        await helyosApplication.createNewMission();
        const result = await helyosApplication.waitAgentStatus(1, 'ready');
        expect(result).toEqual(true);
    });

    it('Microservice is ready', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'ready');
        expect(result).toEqual(true);
    });

    it('Assignment is sent with wrong format, it should fail at the agent', async () => {
        const result = await helyosApplication.waitAssignmentStatus(1, 'failed');
        expect(result).toEqual(true);
    });

    it('Assignment is failed -> Mission is marked as assignment_failed', async () => {
        const result = await helyosApplication.waitMissionStatus(1, 'assignment_failed');
        expect(result).toEqual(true);
    });

    it('Agent is free', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'free');
        expect(result).toEqual(true);
    });

    

  });