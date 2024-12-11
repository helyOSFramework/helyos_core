
// What is being tested:
// Same than test 01 but the mission assignemnt is not calculated by a microserive,
// but directly  an external application that request the mission.
//

process.env.TEST_NUMBER = 6;
console.log("starting test 6");

let helyosApplication;

describe('06 Test Mission Calculated By Ext. App',   () =>  {

    it('External app creates a mission with one embedded assignment and agent is reserved', async () => {
        helyosApplication = await getHelyOSClientInstance();
        await helyosApplication.createMissionWithAssignmentData();
        const result = await helyosApplication.waitAgentStatus(1, 'ready');
        expect(result).toEqual('ready');
    });


    it('Dummy Microservice is ready', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'ready');
        expect(result).toEqual('ready');
    });


    it('Mission produced only one dummy Microservice Request', async () => {
        const result = await helyosApplication.listServiceRequests();
        expect(result.length).toEqual(1);
    });

    it('For Dummy Microservice, response.results is equal the request.results', async () => {
        const servRequest = await helyosApplication.helyosService.serviceRequests.get(1);
        expect(JSON.stringify(servRequest.response.results)).toEqual(JSON.stringify(servRequest.request.results));
    });


    it('Agent is busy', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'busy');
        expect(result).toEqual('busy');
    });

    it('Mission produced one assignment', async () => {
        const result = await helyosApplication.listAssignments();
        expect(result.length).toEqual(1);
    });

    it('Mission is marked as finished', async () => {
        const result = await helyosApplication.waitMissionStatus(1, 'succeeded');
        expect(result).toEqual('succeeded');
    });

    it('Agent is free', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'free');
        expect(result).toEqual('free');
    });

    

  });