// What is being tested:
// Same than test 01 but the mission will failed because microservice produces wrong
// assignment format.


process.env.TEST_NUMBER = 17;
console.log("starting test 17");


let helyosApplication;

describe('17 Test microservice switching and dispatch after assignment',   () =>  {

    it('Agent is reserved', async () => {
        helyosApplication = await getHelyOSClientInstance();
        await helyosApplication.createNewMission('drive_twice', ['Ab34069fc5-fdgs-434b-b87e-f19c5435113']);

        const result = await helyosApplication.waitAgentStatus(1, 'ready');
        expect(result).toEqual('ready');
    });


    it('Microservice is ready', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'ready');
        expect(result).toEqual('ready');
    });


    it('Agent is busy', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'busy');
        expect(result).toEqual('busy');
    });


    it('Assignment 1 is complete', async () => {
        const result = await helyosApplication.waitAssignmentStatus(1, 'completed');
        expect(result).toEqual('completed');
    });


    it(' Microservice B is ready', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(2, 'ready');
        expect(result).toEqual('ready');
    });


    it(' Microservice B2 is skipped', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(3, 'skipped');
        expect(result).toEqual('skipped');
    });


    it('Assignment 2 is completed', async () => {
        const result = await helyosApplication.waitAssignmentStatus(2, 'completed');
        expect(result).toEqual('completed');
    });


    it('Mission is marked as finished', async () => {
        const result = await helyosApplication.waitMissionStatus(1, 'succeeded');
        expect(result).toEqual('succeeded');
    });


    it('Agents are free', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'free');
        expect(result).toEqual('free');
    });


    it('Check 1 x Reserve/ 1 x Release sent to the agent 1', async () => {
        const logs = await helyosApplication.getAgentRelatedLogs('Ab34069fc5-fdgs-434b-b87e-f19c5435113');
        const reservationsSent = logs.filter(log => log.msg.includes('Sending reserve')).length;
        const cancelationsSent = logs.filter(log => log.msg.includes('Sending cancel')).length;
        const releasesSent = logs.filter(log => log.msg.includes('Sending release')).length;

        expect(reservationsSent).toEqual(1);
        expect(cancelationsSent).toEqual(0);
        expect(releasesSent).toEqual(1);
    });  


  });