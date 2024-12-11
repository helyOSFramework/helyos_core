// What is being tested:
// Same than test 01 but the mission will failed because microservice produces wrong
// assignment format.


process.env.TEST_NUMBER = 19;
console.log("starting test 19");


let helyosApplication;

describe('19 Two parallel Assignments ',   () =>  {

    it('Agent is reserved', async () => {
        helyosApplication = await getHelyOSClientInstance();
        await helyosApplication.createNewMission('driving_release', ['Ab34069fc5-fdgs-434b-b87e-f19c5435113',
                                                  'Bb34069fc5-fdgs-434b-b87e-f19c5435113']);
        const result = await helyosApplication.waitAgentStatus(1, 'ready');
        expect(result).toEqual('ready');
    });

    it('Microservice is ready', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'ready');
        expect(result).toEqual('ready');
    });

    it('All Assignments starts at once', async () => {
        const result1 = await helyosApplication.waitAssignmentStatus(1, 'executing');
        const result2 = await helyosApplication.waitAssignmentStatus(2, 'executing');
        const result = result1 === 'executing' && result2 === 'executing';
        expect(result).toEqual(true);
    });

    it('All assignment are completed', async () => {
        const result1 = await helyosApplication.waitAssignmentStatus(1, 'completed');
        const result2 = await helyosApplication.waitAssignmentStatus(2, 'completed');
        const result = result1 === 'completed' && result2 === 'completed';
        expect(result).toEqual(true);

    });


    it('Agent is free', async () => {
        const result1 = await helyosApplication.waitAgentStatus(1, 'free');
        const result2 = await helyosApplication.waitAgentStatus(2, 'free');
        expect(result1).toEqual('free');
        expect(result2).toEqual('free');
    });

    it('Check 1 x Reserves/ 1 x Releases sent to the agent 1', async () => {
        const logs = await helyosApplication.getAgentRelatedLogs('Ab34069fc5-fdgs-434b-b87e-f19c5435113');
        const reservationsSent = logs.filter(log => log.msg.includes('Sending reserve')).length;
        const cancelationsSent = logs.filter(log => log.msg.includes('Sending cancel')).length;
        const releasesSent = logs.filter(log => log.msg.includes('Sending release')).length;

        expect(reservationsSent).toEqual(1);
        expect(cancelationsSent).toEqual(0);
        expect(releasesSent).toEqual(1);
    });  

  });