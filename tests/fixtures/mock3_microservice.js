const nock = require('nock');
const JOBID_3 = 123;

const mapServerResponse = {
    "status": "ready",
    "results": [
        {   update: { 
                origin:{"lat":0, "lon":0, "alt":0},
                map_objects: [
                    {
                            name: "map_object_1",
                            type: "building",
                            data: { points: [ [0, 0], [10, 20], [20, 40], [30, 60], [40, 80], [50, 100]]}
                    },
                    {
                            name: "map_object_2",
                            type: "parking",
                            data: { points: [ [0, 0], [10, 20], [20, 40], [30, 60], [40, 80], [50, 100]]}
                    },
                    {
                            name: "map_object_3",
                            type: "field",
                            data: { points: [ [0, 0], [10, 20], [20, 40], [30, 60], [40, 80], [50, 100]]}
                    }
                ]
            }
        }
    ]

}



overridePathPlannerCalls = () => { 
        
}


overrideMapServerCalls = () => {
    const post_new_calculation = nock("http://my_map_server:9002/api")
    .post('/map/')
    .reply(201, { request_id: JOBID_3 },  {'Content-Type': 'application/json'})


    const get_calculation_result =nock("http://my_map_server:9002/api")
    .get(`/map/${JOBID_3}`)
    .reply(200, { status: 'pending', result: {} },  {'Content-Type': 'application/json'})
    .get(`/map/${JOBID_3}`)
    .reply(200, mapServerResponse,  {'Content-Type': 'application/json'})


}


module.exports.overridePathPlannerCalls = overridePathPlannerCalls;
module.exports.overrideMapServerCalls = overrideMapServerCalls;