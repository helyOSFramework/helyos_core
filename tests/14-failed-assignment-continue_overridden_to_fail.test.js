// What is being tested:
// Same than test 01 but the mission will failed because microservice produces wrong
// assignment format. The microservice response overrides the mission recipe assigment policy.

process.env.TEST_NUMBER = 14;
console.log("starting test 14");


let helyosApplication;

describe('14 Test Failed Assignment - Continue mission - Overridden Fail mission',   () =>  {

    it('Agent is reserved', async () => {
        helyosApplication = await getHelyOSClientInstance();
        await helyosApplication.createNewMission('driving_continue', ['Ab34069fc5-fdgs-434b-b87e-f19c5435113',
                                                  'Bb34069fc5-fdgs-434b-b87e-f19c5435113']);
        const result = await helyosApplication.waitAgentStatus(1, 'ready');
        expect(result).toEqual(true);
    });

    it('Microservice is ready', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'ready');
        expect(result).toEqual(true);
    });

    it('Assignment 1 is sent with wrong format, it should fail at the agent', async () => {
        const result = await helyosApplication.waitAssignmentStatus(1, 'failed');
        expect(result).toEqual(true);
    });

    it('Assignment 2 is completed', async () => {
        const result = await helyosApplication.waitAssignmentStatus(2, 'canceled');
        expect(result).toEqual(true);
    });

    it('Assignment is failed -> Mission goes on => Mission is marked as succeeded', async () => {
        const result = await helyosApplication.waitMissionStatus(1, 'failed');
        expect(result).toEqual(true);
    });

    it('Agent is free', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'free');
        const result2 = await helyosApplication.waitAgentStatus(2, 'free');
        expect(result).toEqual(true);
        expect(result2).toEqual(true);
    });

    it('Check Reserve/Release sent to the agent 1', async () => {
        const logs = await helyosApplication.getAgentRelatedLogs('Ab34069fc5-fdgs-434b-b87e-f19c5435113');
        const reservationsSent = logs.filter(log => log.msg.includes('Sending reserve')).length;
        const cancelationsSent = logs.filter(log => log.msg.includes('Sending cancel')).length;
        const releasesSent = logs.filter(log => log.msg.includes('Sending release')).length;

        expect(reservationsSent).toEqual(1);
        expect(cancelationsSent).toEqual(0);
        expect(releasesSent).toEqual(1);
    });  

    it('Check Reserve- Cancel - Release sent to the agent 2', async () => {
        const logs = await helyosApplication.getAgentRelatedLogs('Bb34069fc5-fdgs-434b-b87e-f19c5435113');
        const reservationsSent = logs.filter(log => log.msg.includes('Sending reserve')).length;
        const cancelationsSent = logs.filter(log => log.msg.includes('Sending cancel')).length;
        const releasesSent = logs.filter(log => log.msg.includes('Sending release')).length;

        expect(reservationsSent).toEqual(1);
        expect(cancelationsSent).toEqual(1);
        expect(releasesSent).toEqual(1);
    });  

  });