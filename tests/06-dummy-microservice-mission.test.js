
// What is being tested:
// Same than test 01 but the mission assignemnt is not calculated by a microserive,
// but directly  an external application that request the mission.
//

process.env.TEST_NUMBER = 6;
console.log("starting test 6");

let helosClientApplication;

describe('06 Test Mission Calculated By Ext. App',   () =>  {

    it('Agent is reserved', async () => {
        helosClientApplication = await setHelyOSClientInstance();
        await helosClientApplication.createMissionWithAssignment();
        const result = await helosClientApplication.waitAgentStatus(1, 'ready');
        expect(result).toEqual(true);
    });



    it('Microservice is ready', async () => {
        const result =  await helosClientApplication.waitMicroserviceStatus(1, 'ready');
        expect(result).toEqual(true);
    });


    it('Mission produced only one dummy Microservice Request', async () => {
        const result = await helosClientApplication.listServiceRequests();
        expect(result.length).toEqual(1);
    });

    it('The Microservice response.results is equal the request.results', async () => {
        const servRequest = await helosClientApplication.helyosService.serviceRequests.get(1);
        expect(JSON.stringify(servRequest.response.results)).toEqual(JSON.stringify(servRequest.request.results));
    });


    it('Agent is busy', async () => {
        const result = await helosClientApplication.waitAgentStatus(1, 'busy');
        expect(result).toEqual(true);
    });

    it('Mission produces one assignment', async () => {
        const result = await helosClientApplication.listAssignments();
        expect(result.length).toEqual(1);
    });

    it('Mission is marked as finished', async () => {
        const result = await helosClientApplication.waitMissionStatus(1, 'succeeded');
        expect(result).toEqual(true);
    });

    it('Agent is free', async () => {
        const result = await helosClientApplication.waitAgentStatus(1, 'free');
        expect(result).toEqual(true);
    });

    

  });