// What is being tested:
// Same than test 01 but the mission will failed because microservice produces wrong
// assignment format. The microservice response overrides the mission recipe assigment policy.


process.env.TEST_NUMBER = 16;
console.log("starting test 16");


let helyosApplication;

describe('16 Test Failed Assignment - Continue mission - Overridden Fallback mission',   () =>  {

    it('Agent is reserved', async () => {
        helyosApplication = await getHelyOSClientInstance();
        await helyosApplication.createNewMission('driving_continue', ['Ab34069fc5-fdgs-434b-b87e-f19c5435113',
                                                  'Bb34069fc5-fdgs-434b-b87e-f19c5435113']);
        const result = await helyosApplication.waitAgentStatus(1, 'ready');
        expect(result).toEqual('ready');
    });

    it('Microservice is ready', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'ready');
        expect(result).toEqual('ready');
    });

    it('Assignment 1 is sent with wrong format, it should fail at the agent', async () => {
        const result = await helyosApplication.waitAssignmentStatus(1, 'failed');
        expect(result).toEqual('failed');
    });

    it('Check failed agent was immediately released ', async () => {
        const logs = await helyosApplication.getAgentRelatedLogs('Ab34069fc5-fdgs-434b-b87e-f19c5435113');
        const releasesSent = logs.filter(log => log.msg.includes('Sending release')).length;
        expect(releasesSent).toEqual(1);
    });  


    it('Fallback Microservice is ready', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'ready');
        expect(result).toEqual('ready');
    });


    it('Assignment 2 is completed', async () => {
        const result = await helyosApplication.waitAssignmentStatus(2, 'completed');
        expect(result).toEqual('completed');
    });


    it('Fallback Assignment for failed agent is completed', async () => {
        const result = await helyosApplication.waitAssignmentStatus(3, 'completed');
        expect(result).toEqual('completed');
    });


    it('Assignment was failed -> Mission goes on => Mission is marked as succeeded', async () => {
        const result = await helyosApplication.waitMissionStatus(1, 'succeeded');
        expect(result).toEqual('succeeded');
    });

    it('Fallback Mission is marked as succeeded', async () => {
        const result = await helyosApplication.waitMissionStatus(2, 'succeeded');
        expect(result).toEqual('succeeded');
    });

    it('Agents are free', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'free');
        const result2 = await helyosApplication.waitAgentStatus(2, 'free');
        expect(result).toEqual('free');
        expect(result2).toEqual('free');
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
