// What is being tested:
// Same than test 01 but the mission will failed because microservice produces wrong
// assignment format.


process.env.TEST_NUMBER = 15;
console.log("starting test 15");


let helyosApplication;

describe('15 Test Failed Assignment - Fallback mission',   () =>  {

    it('Agent is reserved', async () => {
        helyosApplication = await getHelyOSClientInstance();
        await helyosApplication.createNewMission('driving_release_fallback', ['Ab34069fc5-fdgs-434b-b87e-f19c5435113',
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

    it('Check failed agent was immediately released ', async () => {
        const logs = await helyosApplication.getAgentRelatedLogs('Ab34069fc5-fdgs-434b-b87e-f19c5435113');
        const releasesSent = logs.filter(log => log.msg.includes('Sending release')).length;
        expect(releasesSent).toEqual(1);
    });  


    it('Fallback Microservice is ready', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'ready');
        expect(result).toEqual(true);
    });


    it('Assignment 2 is completed', async () => {
        const result = await helyosApplication.waitAssignmentStatus(2, 'completed');
        expect(result).toEqual(true);
    });


    it('Fallback Assignment for failed agent is completed', async () => {
        const result = await helyosApplication.waitAssignmentStatus(3, 'completed');
        expect(result).toEqual(true);
    });


    it('Assignment was failed -> Mission goes on => Mission is marked as succeeded', async () => {
        const result = await helyosApplication.waitMissionStatus(1, 'succeeded');
        expect(result).toEqual(true);
    });

    it('Fallback Mission is marked as succeeded', async () => {
        const result = await helyosApplication.waitMissionStatus(2, 'succeeded');
        expect(result).toEqual(true);
    });

    it('Agents are free', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'free');
        const result2 = await helyosApplication.waitAgentStatus(2, 'free');
        expect(result).toEqual(true);
        expect(result2).toEqual(true);
    });

    it('Check 2 x Reserve/ 3 x Release sent to the agent 1', async () => {
        const logs = await helyosApplication.getAgentRelatedLogs('Ab34069fc5-fdgs-434b-b87e-f19c5435113');
        const reservationsSent = logs.filter(log => log.msg.includes('Sending reserve')).length;
        const cancelationsSent = logs.filter(log => log.msg.includes('Sending cancel')).length;
        const releasesSent = logs.filter(log => log.msg.includes('Sending release')).length;

        expect(reservationsSent).toEqual(2);
        expect(cancelationsSent).toEqual(0);
        expect(releasesSent).toEqual(3);
    });  

    it('Check Reserve/---/Release sent to the agent 2', async () => {
        const logs = await helyosApplication.getAgentRelatedLogs('Bb34069fc5-fdgs-434b-b87e-f19c5435113');
        const reservationsSent = logs.filter(log => log.msg.includes('Sending reserve')).length;
        const cancelationsSent = logs.filter(log => log.msg.includes('Sending cancel')).length;
        const releasesSent = logs.filter(log => log.msg.includes('Sending release')).length;

        expect(reservationsSent).toEqual(1);
        expect(cancelationsSent).toEqual(0);
        expect(releasesSent).toEqual(1);
    });  

  });