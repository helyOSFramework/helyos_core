// This module is responsible for parsing the microservice and mission YML files and populating the database with the parsed data.

const databaseServices = require('../services/database/database_services.js');
const fs = require('fs');
const yaml = require('js-yaml');
const { logData } = require('./systemlog.js');
const lookup = require('./utils.js').lookup;
const OVERWRITE_MISSIONS = false


/**
 * registerManyMicroservices(servicesYmlPath)
 * Parse the microservice.yml file and populate the database.
 * 
 * @param {string} servicesYmlPath
 * @returns {boolean}
 */
const registerManyMicroservices = (servicesYmlPath) => {
    try{     
        const rawdata = fs.readFileSync(servicesYmlPath, {encoding: 'utf-8'})
        const services = yaml.load(rawdata);

        // this loop contains assync code
        flattenServicesData(services).forEach((service, idx) => {
            // create or update service
            databaseServices.services.select({name:service['name']})
            .then((oldServices) => {
                if (oldServices.length === 0) {
                    return databaseServices.services.insert(service);
                } else {
                    const servId = oldServices[0].id;
                    return databaseServices.services.update_byId(servId, service);
                }
            })
            // errors are individualy handled. 
            .catch((error) => {
                console.error(error);
                logData.addLog('helyos_core', null, 'error', `Parsing microservice YML file: ${service.name}` );
            });
        });
        return true;
    }catch (error) {
        console.error('non-critical error', error);
        logData.addLog('helyos_core', null, 'error', `Parsing microservice YML file: ${error}` );

        return null;
    }
    
}

/**
 * registerMissions(missionsYmlPath) 
 * Parse the missions.yml files and populate the database.
 *
 * @param {string} missionsYmlPath
 * @returns {boolean}
 */
const registerMissions = (missionsYmlPath) => {     
    try{
        const rawdata = fs.readFileSync(missionsYmlPath, {encoding: 'utf-8'})
        const missions = yaml.load(rawdata);
        
        // this loop contains assync code.
        flattenMissionsData(missions).forEach((wprocess, idx) => {
            // create or update work process
            databaseServices.work_process_type.select({name:wprocess['name']})
            .then((oldWprocesses) => {
                if (oldWprocesses.length === 0) {
                    return databaseServices.work_process_type.insert(wprocess);
                } else {
                    if (OVERWRITE_MISSIONS) {
                        const wprocId = oldWprocesses[0].id;
                        return databaseServices.work_process_type.update_byId(wprocId, wprocess).then(() => wprocId);
                    }
                    return Promise.resolve(null)
                }
            })
            // update the mission recipe of the work process
            .then((wprocId) => saveWorkProcessServicePlans(wprocess['name'],wprocId,missions))
            // errors are individualy handled. 
            .catch((error) => {
                const errorStr = JSON.stringify(error, Object.getOwnPropertyNames(error));
                logData.addLog('helyos_core', null, 'error', `Parsing mission YML file: ${wprocess.name} ${errorStr}` );
            });
        });

        return true;
    } catch (error) {
        console.error('non-critical error', error);
        logData.addLog('helyos_core', null, 'error', `Parsing mission YML file: ${error}` );

        return null;
    }
	
}


/**
 * saveWorkProcessServicePlans()
 * function which saves all recipe steps of particular workProcessType to the db
 *
 * @param {string} workProcessType
 * @param {number} workProcessTypeId
 * @param {Promise<any>} jsonObj
 */
const saveWorkProcessServicePlans = (
    workProcessType,
    workProcessTypeId,
    jsonObj
    ) => {

            if (workProcessTypeId === null){
                    return Promise.resolve([]);
            }

            // define a mapping object from yml keys to database column names
            const ymlToWorkProcessServicePlanTableMap = {
            work_process_type_id: "work_process_type_id",
            step: "step",
            request_order: "request_order",
            agent: "agent",
            service_type: "service_type",
            service_config: "service_config",
            dependencies: "depends_on_steps",
            wait_assignments: "wait_dependencies_assignments",
            apply_result: "is_result_assignment",
            };
    
            // use lookup to find the missions object in the input json
            const missions = lookup(jsonObj, "missions");
            if (!missions[workProcessType]["recipe"]) { return null}

            // recipe steps array for the given work process type
            const recipeSteps = missions[workProcessType]["recipe"]["steps"];

            // loop through the recipe steps array
            const promiseSequence = []
            promiseSequence.push(databaseServices.work_process_service_plan.remove('work_process_type_id', workProcessTypeId));
            for (const [index, step] of recipeSteps.entries()) {
                // initialize arrays to store the column names and values
                const colNames2 = ["work_process_type_id"];
                const colValues2 = [workProcessTypeId];
    
                // loop through the key-value pairs of each step object
                for (const [key2, value2] of Object.entries(step)) {
                    // check if the key is in the mapping object
                    if (Object.keys(ymlToWorkProcessServicePlanTableMap).indexOf(key2) > -1) {
                    // push the corresponding column name and value to the arrays
                    colNames2.push(ymlToWorkProcessServicePlanTableMap[key2]);
                    colValues2.push(value2);
                    }
                }
    
                // check if the depends_on_steps column is missing
                const dependsOnStepsIndex = colNames2.indexOf("depends_on_steps");
    
                if (dependsOnStepsIndex === -1) {
                    // add the depends_on_steps column with a default value of an empty array
                    colNames2.push("depends_on_steps");
                    colValues2.push("[]");
                }
    
                // initialize an empty object to store the flattened step
                const patchFlat = {};
    
                // loop through the column names and assign them to the flattened step object with their values
                for (const [index, val] of colNames2.entries()) {
                    patchFlat[val] = colValues2[index];
                }
    
                // insert value to work_process_service_plan table
                promiseSequence.push(databaseServices.work_process_service_plan.insert(patchFlat));
            }

            return  Promise.all(promiseSequence);
    };


/*
flattenMissionsData()
function which returns list of flat jsons with missions data.
*/
const flattenMissionsData = (jsonObj) => {
    try {
        // define a mapping object from yml keys to database column names
        const ymlToWorkProcessTypeTableMap = {
        description: "description",
        maxagents: "num_max_agents",
        dispatch_order: "dispatch_order",
        settings: "settings",
        extra_params: "extra_params",
        on_assignment_failure: "on_assignment_failure",
        fallback_mission: "fallback_mission"
        };

        // use lookup to find the missions object in the input json
        const missions = lookup(jsonObj, "missions");
        // initialize an empty array to store the flattened missions
        const missionList = [];

        // loop through the key-value pairs of the missions object
        for (const [key, value] of Object.entries(missions)) {
            // initialize arrays to store the column names and values
            const colNames = ["name"];
            const colValues = [key];

            // loop through the key-value pairs of each mission object
            for (const [key2, value2] of Object.entries(value)) {
                // check if the key is in the mapping object
                if (Object.keys(ymlToWorkProcessTypeTableMap).indexOf(key2) > -1) {
                // push the corresponding column name and value to the arrays
                colNames.push(ymlToWorkProcessTypeTableMap[key2]);
                colValues.push(value2);
                }
            }

            // initialize an empty object to store the flattened mission
            const patchFlat = {};

            // loop through the column names and assign them to the flattened mission object with their values
            for (const [index, val] of colNames.entries()) {
                patchFlat[val] = colValues[index];
            }

            // push the flattened mission object to the mission list array
        missionList.push(patchFlat);
        }

        // return the mission list array
        return missionList;
    } catch (error) {
        // handle any errors and log them to the console
        console.error(error);
        return [];
    }
};

/*
flattenServicesData()
function which returns list of flat jsons with service data.
*/
const flattenServicesData = (jsonObj) => {
    try {
        // define a mapping object from yml keys to database column names
        const ymlToServicesTableMap = {
        domain: "class",
        type: "service_type",
        url: "service_url",
        enable: "enabled",
        apikey: "licence_key",
        config: "config",
        is_dummy: "is_dummy",
        timeout: "result_timeout",
        availability_timeout: "availability_timeout",
        health_endpoint: "health_endpoint",
        context: {
                    all_agents_data: "require_agents_data",
                    mission_agents_data: "require_mission_agents_data",
                    require_map_objects: "require_map_objects",
                    map_data: "require_map_data"
                }
        };

        // use lookup to find the services object in the input json
        const services = lookup(jsonObj, "services");
        // initialize an empty array to store the flattened services
        const serviceList = [];

        // loop through the key-value pairs of the services object
        for (const [key, value] of Object.entries(services)) {
            // initialize arrays to store the column names and values
            const colNames = ["name"];
            const colValues = [key];
            

            // loop through the key-value pairs of each service object
            for (const [key2, value2] of Object.entries(value)) {
                // check if the key is in the mapping object
                if (Object.keys(ymlToServicesTableMap).indexOf(key2) > -1) {
                    // push the corresponding column name and value to the arrays
                    if (key2 !== 'context') {
                        colNames.push(ymlToServicesTableMap[key2]);
                        colValues.push(value2);
                    } else {
                        for (const [key3, value3] of Object.entries(value2)){
                            colNames.push(ymlToServicesTableMap[key2][key3]);
                            colValues.push(value3);
                        }
                    }
                }
            }

            // check if the is_dummy column is missing
            const isDummyIndex = colNames.indexOf("is_dummy");

            if (isDummyIndex === -1) {
                // add the is_dummy column with a default value of false
                colNames.push("is_dummy");
                colValues.push(false);
            }

            // initialize an empty object to store the flattened service
            const patchFlat = {};

            // loop through the column names and assign them to the flattened service object with their values
            for (const [index, val] of colNames.entries()) {
                patchFlat[val] = colValues[index];
            }

            // push the flattened service object to the service list array
            serviceList.push(patchFlat);
        }

        // return the service list array
        return serviceList;
    } catch (error) {
        // handle any errors and log them to the console
        console.error(error);
        return [];
    }
};





module.exports.registerManyMicroservices = registerManyMicroservices;
module.exports.registerMissions = registerMissions;