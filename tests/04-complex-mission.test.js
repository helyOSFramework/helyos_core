
// What is being tested:
// Complex mission composed of map update and driving.
// It combines the actions of tests 01 and 03 in one single mission.
//


process.env.TEST_NUMBER = 4;
console.log("starting test 4");

let helyosApplication;

describe('04 Test Mission composed of map update and driving',   () =>  {

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

    it('Map microservice is calculating', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'pending');
        expect(result).toEqual(true);
    });

    it('Map microservice is ready', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'ready');
        expect(result).toEqual(true);
    });

    it('Yard has many map objects', async () => {
        const result = await helyosApplication.listMapObjects();
        expect(result.length).toBeGreaterThan(0);
    });

    it('Assignment microservice is calculating', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(2, 'pending');
        expect(result).toEqual(true);
    });

    it('Assignment microservice is ready', async () => {
        const result =  await helyosApplication.waitMicroserviceStatus(2, 'ready');
        expect(result).toEqual(true);
    });

    it('Agent is busy', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'busy');
        expect(result).toEqual(true);
    });


    it('Agent is free', async () => {
        const result = await helyosApplication.waitAgentStatus(1, 'free');
        expect(result).toEqual(true);
    });

    it('Mission is marked as finished', async () => {
        const result = await helyosApplication.waitMissionStatus(1, 'succeeded');
        expect(result).toEqual(true);
    });
    

  });