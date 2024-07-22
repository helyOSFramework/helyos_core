const nock = require('nock');
const JOBID_8 = 124;

const pathPlannerResponse = {
    "status": "ready",
    "results": [
        {   "agent_uuid": "Ab34069fc5-fdgs-434b-b87e-f19c5435113", 
            "assignment": {'operation':'driving',
                            bad_format_trajectory: [   // incorrect key name causes the agent to fail..
                            {"x": 0 , "y":0,    "orientations":[0, 0 ], time: 1},
                            {"x": 10 , "y":20,  "orientations":[1000, 0 ], time: 2},
                            {"x": 20 , "y":40,  "orientations":[2000, 0 ], time: 3},
                            {"x": 30 , "y":60,  "orientations":[3000, 0 ], time: 4},
                            {"x": 40 , "y":80,  "orientations":[4000, 0 ], time: 5},
                            {"x": 50 , "y":100, "orientations":[5000, 0 ], time: 6},
            ]}
        },
        {   "agent_uuid": "Bb34069fc5-fdgs-434b-b87e-f19c5435113", 
            "assignment": {'operation':'driving',
                            trajectory: [
                            {"x": 0 , "y":0,    "orientations":[0, 0 ], time: 1},
                            {"x": 10 , "y":20,  "orientations":[1000, 0 ], time: 2},
                            {"x": 20 , "y":40,  "orientations":[2000, 0 ], time: 3},
                            {"x": 30 , "y":60,  "orientations":[3000, 0 ], time: 4},
                            {"x": 40 , "y":80,  "orientations":[4000, 0 ], time: 5},
                            {"x": 50 , "y":100, "orientations":[5000, 0 ], time: 6},
            ]}
        },
    ]

}



overridePathPlannerCalls = () => { 
        const post_new_calculation = nock('http://my_path_planner:9002/api/') // immediately returns a response
        .post('/plan_job/')
        .reply(201, { request_id: JOBID_8, ...pathPlannerResponse },  {'Content-Type': 'application/json'});
}


overrideMapServerCalls = () => {


}


module.exports.overridePathPlannerCalls = overridePathPlannerCalls;
module.exports.overrideMapServerCalls = overrideMapServerCalls;