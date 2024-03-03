const nock = require('nock');
const JOBID_1 = 123;
const JOBID_2 = 124;



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


overrideMapServerCalls = () => {
    const post_new_calculation = nock("http://my_map_server:9002/api")
    .post('/map/')
    .reply(201, { request_id: JOBID_1 },  {'Content-Type': 'application/json'})


    const get_calculation_result =nock("http://my_map_server:9002/api")
    .get(`/map/${JOBID_1}`)
    .reply(200, { status: 'pending', result: {} },  {'Content-Type': 'application/json'})
    .get(`/map/${JOBID_1}`)
    .reply(200, { status: 'pending', result: {} },  {'Content-Type': 'application/json'})
    .get(`/map/${JOBID_1}`)
    .reply(200, mapServerResponse,  {'Content-Type': 'application/json'})

}


const pathPlannerResponse = {
    "status": "ready",
    "results": [
        {   "agent_uuid": "Ab34069fc5-fdgs-434b-b87e-f19c5435113", 
            "assignment": {'operation':'driving',
                            trajectory: [
                            {"x": 0 , "y":0,    "orientations":[0, 0 ], time: null},
                            {"x": 10 , "y":20,  "orientations":[1000, 0 ], time: null},
                            {"x": 20 , "y":40,  "orientations":[2000, 0 ], time: null},
                            {"x": 30 , "y":60,  "orientations":[3000, 0 ], time: null},
                            {"x": 40 , "y":80,  "orientations":[4000, 0 ], time: null},
                            {"x": 50 , "y":100, "orientations":[5000, 0 ], time: null},
            ]}
        }
    ]

}



overridePathPlannerCalls = () => {
        const post_new_calculation = nock('http://my_path_planner:9002/api/')
        .post('/plan_job/')
        .reply(201, { request_id: JOBID_2 },  {'Content-Type': 'application/json'})

        const get_calculation_result = nock('http://my_path_planner:9002/api/')
        .get(`/plan_job/${JOBID_2}`)
        .reply(200, { status: 'pending', results: {} },  {'Content-Type': 'application/json'})
        .get(`/plan_job/${JOBID_2}`)
        .reply(200, { status: 'pending', results: {} },  {'Content-Type': 'application/json'})
        .get(`/plan_job/${JOBID_2}`)
        .reply(200, { status: 'pending', results: {} },  {'Content-Type': 'application/json'})
        .get(`/plan_job/${JOBID_2}`)
        .reply(200, { status: 'pending', results: {} },  {'Content-Type': 'application/json'})
        .get(`/plan_job/${JOBID_2}`)
        .reply(200, { status: 'pending', results: {} },  {'Content-Type': 'application/json'})
        .get(`/plan_job/${JOBID_2}`)
        .reply(200, pathPlannerResponse ,  {'Content-Type': 'application/json'});
        
}



module.exports.overridePathPlannerCalls = overridePathPlannerCalls;
module.exports.overrideMapServerCalls = overrideMapServerCalls;