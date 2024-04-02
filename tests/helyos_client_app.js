const { HelyosServices } = require('helyosjs-sdk');
const HOST_NAME = process.env.HOST_NAME || 'localhost';
const GRAPHQL_PORT = process.env.GRAPHQL_PORT || 5000;
const SOCKET_PORT = process.env.SOCKET_PORT || 5002
const fs = require('fs');


class HelyOSClientApplication {

    constructor(hostname, graphqlPort, sockerPort) {
        this.url = `http://${hostname}`;
        this.helyosService =  new HelyosServices(this.url, {socketPort:sockerPort, gqlPort:graphqlPort});;
    }

    login(username, password) {
        return this.helyosService.login(username, password).then(() => this.helyosService.connect());
    }


    logout() {
        return this.helyosService.logout().finally(() => this.helyosService.socket.disconnect());
    }

    _waitStatus(checkValuePromise, id, status) {
        return new Promise((resolve, reject) => {
            let tries = 1;
            const maxTries = 20;
            const watcher = setInterval( async () => {
                let result;
                try {
                    result = await checkValuePromise(id);
                } catch (error) {
                    console.log(`Status for ${id} not yet available. Retrying...`);
                    result = {check: false, value: null};
                }

                if (result['check']){
                    clearInterval(watcher);
                    resolve(true);
                } 
       
                tries += 1;
                if (tries > maxTries){
                    console.log(`Max tries reached for ${id} with status ${result['value']}`);
                    clearInterval(watcher);
                    resolve(false);
                }
            }, 1000); 
        });

    }


    waitAgentStatus(agentId, status) {
        const checkValue = (agentId) => {
            return this.helyosService.agents.get(agentId)
                  .then(serv => ({check: serv.status === status, value: serv.status}))
                  .catch(err => ({check: false, value: null}));

        }
  
        return this._waitStatus(checkValue, agentId, status);
    }



    waitMicroserviceStatus(id, status) {
        const checkValue = (id) => {
            return this.helyosService.serviceRequests.get(id)
                  .then(serv => ({check: serv.status === status, value: serv.status}))
                  .catch(err => ({check: false, value: null}));

        }
  
        return this._waitStatus(checkValue, id, status);
    }


    waitAssignmentStatus(id, status) {
        const checkValue = (id) => {
            return this.helyosService.assignments.get(id)
                  .then(serv => ({check: serv.status === status, value: serv.status}))
                  .catch(err => ({check: false, value: null}));
        }
  
        return this._waitStatus(checkValue, id, status);
    }


    waitMissionStatus(id, status) {
        const checkValue = (id) => {
            return this.helyosService.workProcess.get(id)
                  .then(serv => ({check: serv.status === status, value: serv.status}))
                  .catch(err => ({check: false, value: null}));
        }
  
        return this._waitStatus(checkValue, id, status);
    }

    waitMissionQueueStatus(id, status) {
        const checkValue = (id) => {
            return this.helyosService.missionQueue.get(id)
                  .then(serv => ({check: serv.status === status, value: serv.status}))
                  .catch(err => ({check: false, value: null}));
        }
  
        return this._waitStatus(checkValue, id, status);
    }

    createNewMission(missionType = 'driving') {
        return this.helyosService.workProcess.create({
            agentUuids: ["Ab34069fc5-fdgs-434b-b87e-f19c5435113"],   //  is the agent uuid. 
            yardId: 1,       // the yard where the agent has checked in.
            workProcessTypeName: missionType,  // name of the mission recipe as defined in helyOS dashboard
            data: { "foo:": "bar", agent_id:1  },        // this data format depends on the microservice.
            status: 'dispatched',            // status = 'draft' will save the mission but no dispatch it.
        });
    }

    createMissionForQueue(missionType = 'driving', queueId = null, runOrder = 1) {
        return this.helyosService.workProcess.create({
            agentUuids: ["Ab34069fc5-fdgs-434b-b87e-f19c5435113"],   //  is the agent uuid. 
            yardId: 1,       // the yard where the agent has checked in.
            workProcessTypeName: missionType,  // name of the mission recipe as defined in helyOS dashboard
            data: { "foo:": "bar", agent_id:1  },        // this data format depends on the microservice.
            status: 'draft',            // status = 'draft' will save the mission but no dispatch it.
            runOrder: runOrder,
            missionQueueId: queueId
        });
    }


    createNewQueue() {
        return this.helyosService.missionQueue.create({ 
            name: 'test_queue',
            description: 'test_queue',
            status: 'stopped'
        }).then(queue => queue.id);
    }


    startQueue(queueId) {
        return this.helyosService.missionQueue.patch({id: queueId, status: 'run'});
    }




    createMapUpdate() {
        return this.helyosService.workProcess.create({
            agentUuids: [],   //  is the agent uuid. 
            yardId: 1,       // the yard where the agent has checked in.
            workProcessTypeName: 'mapping',  // name of the mission recipe as defined in helyOS dashboard
            data: { "foo:": "bar", agent_id:1  },        // this data format depends on the microservice.
            status: 'dispatched',            // status = 'draft' will save the mission but no dispatch it.
        });
    }

    cancelMission(id) {
        return this.helyosService.workProcess.patch({id, status: 'canceling'});
    }


    createMissionWithAssignmentData() {
        return this.helyosService.workProcess.create({
            agentUuids: ["Ab34069fc5-fdgs-434b-b87e-f19c5435113"],   //  is the agent uuid. 
            yardId: 1,       // the yard where the agent has checked in.
            workProcessTypeName: "driving_assignment_data_from_app",  // name of the mission recipe as defined in helyOS dashboard
            status: 'dispatched',                // status = 'draft' will save the mission but no dispatch it.
            data: {
                "status": "ready",
                "results": [
                    {   "agent_uuid": "Ab34069fc5-fdgs-434b-b87e-f19c5435113", 
                        "assignment": {'operation':'driving',
                                        trajectory: [
                                        {"x": 0 ,  "y":0,   "orientations":[0, 0 ], time: null},
                                        {"x": 10 , "y":20,  "orientations":[1000, 0 ], time: null},
                                        {"x": 20 , "y":40,  "orientations":[2000, 0 ], time: null},
                                        {"x": 30 , "y":60,  "orientations":[3000, 0 ], time: null},
                                        {"x": 40 , "y":80,  "orientations":[4000, 0 ], time: null},
                                        {"x": 50 , "y":100, "orientations":[5000, 0 ], time: null}
                        ]}
                    }
                ]
            }
        });
    }

    createAssistantAgent(uuid) {
        return this.helyosService.agents.create({
            name: uuid,
            uuid: uuid,
            rbmqUsername: uuid,
            agentClass: 'assistant',
            yardId: 1,
        })
        .then(agent =>  this.helyosService.agents.createRabbitMQAgent(parseInt(agent.id), uuid, 'helyos_secret'));
        
    };



    listMapObjects(){
        return this.helyosService.mapObjects.list({});
    }

    listAssignments(){
        return this.helyosService.assignments.list({});
    }

    listServiceRequests(){
        return this.helyosService.serviceRequests.list({});
    }



    dumpLogsToFile(testNunber=1){
        return this.helyosService.systemLogs.list({})
        .then(logs => {
            return fs.writeFileSync(`logs/test${testNunber}.log`, JSON.stringify(logs, null, 2));
        });
    }


}

//Singleton HelyOS client application
const helyosClientApplication = new HelyOSClientApplication(HOST_NAME, GRAPHQL_PORT, SOCKET_PORT);

module.exports = {helyosClientApplication};