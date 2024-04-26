
// What is being tested:
// Canceling of complex mission composed of map update and driving.
// It combines the actions of tests 01 and 03 in one single mission and then cancels it before the agent is assigned.
//


process.env.TEST_NUMBER = 10;
console.log("starting test 10");

let helyosApplication;

describe('10 Test Mission composed of map update and driving',   () =>  {

    it('Yard has no map objects', async () => {
        helyosApplication = await getHelyOSClientInstance();
        const result = await helyosApplication.listMapObjects();
        expect(result.length).toEqual(0);
    });

    it('Mission is dispatched -> Agent is reserved', async () => {
        await helyosApplication.createNewMission('map_driving');
        const result = await helyosApplication.waitAgentStatus(1, 'ready');
        expect(result).toEqual(true);
    });

    it('Mission is canceled by app -> Microservice is canceled, agent has not yet an assignment', async () => {
        await helyosApplication.cancelMission(1);
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'canceled');
        expect(result).toEqual(true);
    });


    it('Yard has still no map objects', async () => {
        helyosApplication = await getHelyOSClientInstance();
        const result = await helyosApplication.listMapObjects();
        expect(result.length).toEqual(0);
    });

    it('Agent is free', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'free');
        expect(result).toEqual(true);
    });

    it('Mission status is canceled', async () => {
        const result = await helyosApplication.waitMissionStatus(1, 'canceled');
        expect(result).toEqual(true);
    });

    it('Check Reserve/Release/Cancel sent to the agent', async () => {
        const logs = await helyosApplication.getAgentRelatedLogs('Ab34069fc5-fdgs-434b-b87e-f19c5435113');
        const reservationsSent = logs.filter(log => log.msg.includes('Sending reserve')).length;
        const cancelationsSent = logs.filter(log => log.msg.includes('Sending cancel')).length;
        const releasesSent = logs.filter(log => log.msg.includes('Sending release')).length;

        expect(reservationsSent).toEqual(1);
        expect(cancelationsSent).toEqual(0);
        expect(releasesSent).toEqual(1);
    });  
    

  });