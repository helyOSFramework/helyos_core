import { H_WorkProcessServicePlan, H_WorkProcessType } from 'helyosjs-sdk';
import { WORKPROCESS_SERVICE_PLAN } from 'helyosjs-sdk/dist/cruds/wprocess_service_matrix';
import { WORKPROCESS_TYPE } from 'helyosjs-sdk/dist/cruds/wprocess_types';
import { isObjectProperty, yamlDump, yamlLoad } from 'src/app/shared/utilities';

const ymlJsonIndent = 2;

const WorkProcessTypeTableToYmlMap = {
  description: 'description',
  numMaxAgents: 'maxagents',
  dispatchOrder: 'dispatch_order',
  settings: 'settings',
  extraParams: 'extra_params',
};

const ymlToWorkProcessTypeTableMap = {
  description: "description",
  maxagents: "numMaxAgents",
  dispatch_order: "dispatchOrder",
  settings: "settings",
  extra_params: "extraParams",
};

const WorkProcessServicePlanTableToYmlMap = {
  // workProcessTypeId: 'work_process_type_id',
  step: 'step',
  requestOrder: 'request_order',
  agent: 'agent',
  serviceType: 'service_type',
  serviceConfig: 'service_config',
  dependsOnSteps: 'dependencies',
  isResultAssignment: 'apply_result',
  waitDependenciesAssignments: 'wait_assignments',

};

const ymlToWorkProcessServicePlanTableMap = {
  work_process_type_id: 'workProcessTypeId',
  step: 'step',
  request_order: 'requestOrder',
  agent: 'agent',
  service_type: 'serviceType',
  service_config: 'serviceConfig',
  dependencies: 'dependsOnSteps',
  wait_assignments: 'waitDependenciesAssignments',
  apply_result: 'isResultAssignment',
};

export const exportToYML = async (wpTypeMethods: WORKPROCESS_TYPE, wpServPlanMethods: WORKPROCESS_SERVICE_PLAN) => {
  // Template JSON to populate data from tables
  const workprocessTypes: H_WorkProcessType[] = await wpTypeMethods.list({});
  const workprocessPlans: H_WorkProcessServicePlan[] = await wpServPlanMethods.list({});

  const missions = parseWorkProcess(workprocessTypes, workprocessPlans);
  const ymlData = missionstoYML(missions);

  return Promise.resolve(ymlData);
};

const parseWorkProcess = (workprocessTypes: H_WorkProcessType[], workprocessPlans: H_WorkProcessServicePlan[]) => {
  const missions = {};

  workprocessTypes.forEach((wpType) => {
    const wpTypeName = wpType.name;

    // parse properites of work_process_type into missions
    const mission = {};
    for (const [key, wpTypeValue] of Object.entries(wpType)) {
      if (isObjectProperty(WorkProcessTypeTableToYmlMap, key)) {
        const mappedKey = WorkProcessTypeTableToYmlMap[key];
        if (["settings", "dispatchOrder"].includes(key)) {
          // JSON.stringify() is used to preserve list brackets
          if (wpTypeValue !== null) {
            mission[mappedKey] = JSON.stringify(wpTypeValue, null, ymlJsonIndent);
          }
        } else {
          mission[mappedKey] = wpTypeValue;
        }
      }
    }
    missions[wpTypeName] = mission;

    // parse wp_plans into mission steps
    const wpTypeRecipeSteps = workprocessPlans.filter(e => e.workProcessTypeId === wpType.id);
    const formatedSteps = parseWorkProcessRecipeSteps(wpTypeRecipeSteps);

    if (formatedSteps.length > 0) {
      missions[wpTypeName]['recipe'] = {
        'steps': formatedSteps,
      };
    }
  });

  return missions;
};

const parseWorkProcessRecipeSteps = (wpTypeRecipeSteps: H_WorkProcessServicePlan[]) => {
  const formattedSteps = wpTypeRecipeSteps.map((wpStep) => {
    const formattedStep = {};
    for (const [key, wpStepValue] of Object.entries(wpStep)) {
      if (isObjectProperty(WorkProcessServicePlanTableToYmlMap, key)) {
        const mappedKey = WorkProcessServicePlanTableToYmlMap[key];
        if (["dependsOnSteps", "serviceConfig"].includes(key)) { // JSON.stringify() is used to preserve list brackets
          if (wpStepValue != null) {
            formattedStep[mappedKey] = JSON.stringify(wpStepValue, null, ymlJsonIndent);
          }
        } else {
          formattedStep[mappedKey] = wpStepValue;
        }
      }
    }

    // add dummy service_config if not present
    if (!isObjectProperty(formattedStep, 'service_config')) {
      formattedStep['service_config'] = null;
    }
    return formattedStep;

  });
  return formattedSteps;
};

const missionstoYML = (missions: object) => {
  const dataJSON = {
    'version': '2.0',
    'missions': missions,
  };
  // convert JSON to yml
  let ymlData = yamlDump(dataJSON);
  ymlData = ymlData
    .replace(/(\n\s{2}\w+:)/g, '\n\n$1') // 2 line spaces before mission name at 2 spaces indentation
    .replace(/(\n\s+- step:)/g, '\n$1'); // 1 line space before each step

  return ymlData;
};

/**
 * registerMissions(missionsYmlPath)
 * Parse the missions.yml files and populate the database.
 *
 * @param {string} missionsYmlPath
 * @returns {boolean}
 */
export const importFromYML = (rawdata: string, wpTypeMethods: WORKPROCESS_TYPE, wpServPlanMethods: WORKPROCESS_SERVICE_PLAN) => {
  try {

    const missions = yamlLoad(rawdata) as object;
    const promises = flattenMissionsData(missions).map(
      async (wprocess) => {
        const workProcessTypeName = wprocess['name'];
        // create or update work process
        const oldWprocesses = await wpTypeMethods.list({
          name: workProcessTypeName,
        });
        let wprocId;
        if (oldWprocesses.length === 0) {
          const newWPType = await wpTypeMethods.create(wprocess);
          wprocId = newWPType.id;
        } else {
          wprocId = oldWprocesses[0].id;
          await wpTypeMethods.patch({
            id: wprocId,
            ...wprocess,
          });
        }
        // update the mission recipe of the work process

        return saveWorkProcessServicePlans(wpServPlanMethods, wprocess['name'], parseInt(wprocId), missions);
      });

    return Promise.all(promises);
  } catch (error) {
    console.log('importFromYML error', error);
    return Promise.reject(error);
  }

};

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * saveWorkProcessServicePlans()
 * function which saves all recipe steps of particular workProcessType to the db
 *
/**
 * @param {string} workProcessType
 * @param {number} workProcessTypeId
 * @param {Promise<any>} jsonObj
 */
const saveWorkProcessServicePlans = (
  serviceMethods: WORKPROCESS_SERVICE_PLAN,
  workProcessType: string,
  workProcessTypeId: any,
  jsonObj: any
) => {

  const deletePromises = (wprocTypeId) => serviceMethods.list({
    workProcessTypeId: wprocTypeId,
  })
    .then((wprocSteps) => {
      const promises = wprocSteps.map((wprocStep) => serviceMethods.delete(wprocStep.id));
      return Promise.all(promises);
    });

  // use lookup to find the missions object in the input json
  const missions = lookup(jsonObj, 'missions');
  if (!missions[workProcessType]['recipe']) {
    return null;
  }

  // recipe steps array for the given work process type
  const recipeSteps = missions[workProcessType]['recipe']['steps'];

  // loop through the recipe steps array
  const promiseSequence = [];
  promiseSequence.push(deletePromises(workProcessTypeId));
  for (const [_index, step] of recipeSteps.entries()) {
    // initialize arrays to store the column names and values
    const colNames2 = [ymlToWorkProcessServicePlanTableMap['work_process_type_id']];
    const colValues2 = [workProcessTypeId];
    // loop through the key-value pairs of each step object
    for (const [key2, value2] of Object.entries(step)) {
      // check if the key is in the mapping object
      if (isObjectProperty(ymlToWorkProcessServicePlanTableMap, key2)) {
        // push the corresponding column name and value to the arrays
        colNames2.push(ymlToWorkProcessServicePlanTableMap[key2]);
        colValues2.push(value2);
      }
    }

    // check if the depends_on_steps column is missing
    const dependsOnStepsIndex = colNames2.indexOf(ymlToWorkProcessServicePlanTableMap['dependencies']);

    if (dependsOnStepsIndex === -1) {
      // add the depends_on_steps column with a default value of an empty array
      colNames2.push(ymlToWorkProcessServicePlanTableMap['dependencies']);
      colValues2.push('[]');
    }

    // initialize an empty object to store the flattened step
    const patchFlat = {};

    // loop through the column names and assign them to the flattened step object with their values
    for (const [index, val] of colNames2.entries()) {
      patchFlat[val] = colValues2[index];
    }

    // insert value to work_process_service_plan table
    promiseSequence.push(serviceMethods.create(patchFlat));
  }

  return Promise.all(promiseSequence);
};

/* eslint-enable @typescript-eslint/no-explicit-any */

/*
flattenMissionsData()
function which returns list of flat jsons with missions data.
*/
const flattenMissionsData = (jsonObj: object) => {
  try {

    // use lookup to find the missions object in the input json
    const missions = lookup(jsonObj, 'missions');
    // initialize an empty array to store the flattened missions
    const missionList = [];

    // loop through the key-value pairs of the missions object
    for (const [key, value] of Object.entries(missions)) {
      // initialize arrays to store the column names and values
      const colNames = ['name'];
      const colValues = [key];

      // loop through the key-value pairs of each mission object
      for (const [key2, value2] of Object.entries(value)) {
        // check if the key is in the mapping object
        if (isObjectProperty(ymlToWorkProcessTypeTableMap, key2)) {
          // push the corresponding column name and value to the arrays
          colNames.push(ymlToWorkProcessTypeTableMap[key2]);

          if (["settings", "extraParams", "dependencies", "serviceConfig"].includes(key2)) {
            if (value2 != null) {
              colValues.push(JSON.parse(value2));
            } else {
              colValues.push(null);
            }
          } else {
            colValues.push(value2);
          }
        }
      }

      // initialize an empty object to store the flattened mission
      const patchFlat = {};

      // loop through the column names and assign them to the flattened mission object with their values
      for (const [key, value] of colNames.entries()) {
        patchFlat[value] = colValues[key];
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
lookup()
function to search for nested objects by their keys.
*/
const lookup = (object: object, key: string) => {
  try {
    // check if the input is an object
    if (typeof object !== 'object') {
      return null;
    }
    let result = null;
    // check if the object has the key as a direct property
    if (isObjectProperty(object, key)) {
      return object[key];
    } else {
      // otherwise, loop through the values of the object
      for (const value of Object.values(object)) {
        // recursively call lookup on each value
        result = lookup(value, key);
        // if the result is not null, break the loop
        if (result == null) {
          continue;
        } else {
          break;
        }
      }
    }
    // return the result
    return result;
  } catch (error) {
    // handle any errors and log them to the console
    console.error(error);
    return null;
  }
};
