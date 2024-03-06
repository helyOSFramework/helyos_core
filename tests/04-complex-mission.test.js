
// What is being tested:
// Complex mission composed of map update and driving.
// It combines the actions of tests 01 and 03 in one single mission.
//


process.env.TEST_NUMBER = 4;
console.log("starting test 4");

let helosClientApplication;

describe('04 Test Mission composed of map update and driving',   () =>  {

    it('Yard has no map objects', async () => {
        helosClientApplication = await setHelyOSClientInstance();
        const result = await helosClientApplication.listMapObjects();
        expect(result.length).toEqual(0);
    });

    it('Mission is dispatched -> Agent is reserved', async () => {
        await helosClientApplication.createNewMission('map_driving');
        const result = await helosClientApplication.waitAgentStatus(1, 'ready');
        expect(result).toEqual(true);
    });

    it('Map microservice is calculating', async () => {
        const result =  await helosClientApplication.waitMicroserviceStatus(1, 'pending');
        expect(result).toEqual(true);
    });

    it('Map microservice is ready', async () => {
        const result =  await helosClientApplication.waitMicroserviceStatus(1, 'ready');
        expect(result).toEqual(true);
    });

    it('Yard has many map objects', async () => {
        const result = await helosClientApplication.listMapObjects();
        expect(result.length).toBeGreaterThan(0);
    });

    it('Assignment microservice is calculating', async () => {
        const result =  await helosClientApplication.waitMicroserviceStatus(2, 'pending');
        expect(result).toEqual(true);
    });

    it('Assignment microservice is ready', async () => {
        const result =  await helosClientApplication.waitMicroserviceStatus(2, 'ready');
        expect(result).toEqual(true);
    });

    it('Agent is busy', async () => {
        const result = await helosClientApplication.waitAgentStatus(1, 'busy');
        expect(result).toEqual(true);
    });


    it('Agent is free', async () => {
        const result = await helosClientApplication.waitAgentStatus(1, 'free');
        expect(result).toEqual(true);
    });

    it('Mission is marked as finished', async () => {
        const result = await helosClientApplication.waitMissionStatus(1, 'succeeded');
        expect(result).toEqual(true);
    });
    

  });