const nock = require('nock');
const JOBID_1 = 123;

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
                            {"x": 60 , "y":100, "orientations":[5000, 0 ], time: null},
                            {"x": 70 , "y":100, "orientations":[5000, 0 ], time: null},
                            {"x": 80 , "y":100, "orientations":[5000, 0 ], time: null},
                            {"x": 90 , "y":100, "orientations":[5000, 0 ], time: null},
                            {"x": 100 , "y":100, "orientations":[5000, 0 ], time: null},
            ]}
        }
    ]

}


const pause_instant_action = {
    "status": "ready",
    "results": [
        {   "agent_uuid": "Ab34069fc5-fdgs-434b-b87e-f19c5435113", 
            "instant_action": {'command':'pause'}
        }
    ]
}

const resume_instant_action = {
    "status": "ready",
    "results": [
        {   "agent_uuid": "Ab34069fc5-fdgs-434b-b87e-f19c5435113", 
            "instant_action": {'command':'resume'}
        }
    ]
}


overridePathPlannerCalls = () => {
        const post_new_calculation = nock('http://my_path_planner:9002/api/')
        .post('/plan_job/')
        .reply(201, { request_id: JOBID_1 },  {'Content-Type': 'application/json'})

        const get_calculation_result = nock('http://my_path_planner:9002/api/')
        .get(`/plan_job/${JOBID_1}`)
        .reply(200, { status: 'pending', results: {} },  {'Content-Type': 'application/json'})
        .get(`/plan_job/${JOBID_1}`)
        .reply(200, { status: 'pending', results: {} },  {'Content-Type': 'application/json'})
        .get(`/plan_job/${JOBID_1}`)
        .reply(200, pathPlannerResponse ,  {'Content-Type': 'application/json'});
        
        const post_new_instant_action = nock('http://instant_action_planner:9002/api/')
        .post('/plan_job/')
        .reply(201, pause_instant_action ,  {'Content-Type': 'application/json'})
        .post('/plan_job/')
        .reply(201, resume_instant_action ,  {'Content-Type': 'application/json'});


}


overrideMapServerCalls = () => {


}


module.exports.overridePathPlannerCalls = overridePathPlannerCalls;
module.exports.overrideMapServerCalls = overrideMapServerCalls;