// What is being tested:
// Creation of work process triggers request to external map service.
// External service response trigger update and insertion of new map objects.    

process.env.TEST_NUMBER = 3;
console.log("starting test 3");

let helyosApplication;

describe('03 Map Update Mission',   () =>  {

    it('Yard has no map objects', async () => {
        helyosApplication = await getHelyOSClientInstance();
        const result = await helyosApplication.listMapObjects();
        expect(result.length).toEqual(0);
    });

    it('Update request -> Map microservice is ready', async () => {
        await helyosApplication.createMapUpdate();
        const result =  await helyosApplication.waitMicroserviceStatus(1, 'ready');
        expect(result).toEqual(true);
    });

    it('Yard has many map objects', async () => {
        const result = await helyosApplication.listMapObjects();
        expect(result.length).toBeGreaterThan(0);
    });


    it('Mission is marked as finished', async () => {
        const result = await helyosApplication.waitMissionStatus(1, 'succeeded');
        expect(result).toEqual(true);
    });

  });