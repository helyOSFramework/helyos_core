// What is being tested:
// Same than test 01 but the mission is canceled by the app.
// User cancels the assignment and Agent becomes free.

process.env.TEST_NUMBER = 2;
console.log("starting test 2");


let helyosApplication;

describe('02 Test Canceled Mission',   () =>  {

    it('Agent is reserved', async () => {
        helyosApplication = await getHelyOSClientInstance();
        await helyosApplication.createNewMission();
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

    it('Mission is canceled by app -> Agent must cancel assignment', async () => {
        await helyosApplication.cancelMission(1);
        const result = await helyosApplication.waitAssignmentStatus(1, 'canceled');
        expect(result).toEqual('canceled');
    });

    it('Assignment is canceled -> Mission is canceled', async () => {
        const result = await helyosApplication.waitMissionStatus(1, 'canceled');
        expect(result).toEqual('canceled');
    });

    it('Agent is free', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'free');
        expect(result).toEqual('free');
    });

    it('Check Reserve/Release/Cancel sent to the agent', async () => {
        const logs = await helyosApplication.getAgentRelatedLogs('Ab34069fc5-fdgs-434b-b87e-f19c5435113');
        const reservationsSent = logs.filter(log => log.msg.includes('Sending reserve')).length;
        const cancelationsSent = logs.filter(log => log.msg.includes('Sending cancel')).length;
        const releasesSent = logs.filter(log => log.msg.includes('Sending release')).length;

        expect(reservationsSent).toEqual(1);
        expect(cancelationsSent).toEqual(1);
        expect(releasesSent).toEqual(1);
    });  
    

  });