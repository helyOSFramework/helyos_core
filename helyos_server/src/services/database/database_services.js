// ----------------------------------------------------------------------------
// Postgres client setup 
// ----------------------------------------------------------------------------

const { UNCOMPLETE_ASSIGNM_STATUSES, UNCOMPLETE_ASSIGNM_BEFORE_DISPATCH, UNCOMPLETE_ASSIGNM_AFTER_DISPATCH } = require('../../modules/data_models');
const { DatabaseLayer, AgentDataLayer, Client, 
	searchAllRelatedUncompletedAssignments, 
	getUncompletedAssignments_byWPId,
	updateAgentsConnectionStatus, setDBTimeout} = require('./postg_access_layer');

// Singleton database clients
const mainClient =  new Client();
const shortTimeClient = new Client();
const pgNotifications = new Client();


const connectToDB = async (_client, statementTimeout = 0) => {
	await _client.connect();
	console.log("CREATE DATABASE CLIENT CONNECTION");
	if (statementTimeout > 0) {
		await _client.query(`SET statement_timeout = ${statementTimeout}`);
		console.log(`Statement timeout set to ${statementTimeout} milliseconds`);
	}
}

const disconnectFromDB = async (clients) => {
	return Promise.all(clients.map( client => client.end()))
}




connectToDB(mainClient); // async
connectToDB(shortTimeClient, 1000); // async short timeout for queries
connectToDB(pgNotifications); // async


const getNewClient = () => {
	const client = new Client();
	return client.connect().then(() => client);
}



const agents = new AgentDataLayer(mainClient, shortTimeClient);


/**
Connects the leader agent with the specified followers, disconnects any followers that are not desired,
and inserts new connections for desired followers.
@param {string} leaderUUID - The UUID of the leader agent.
@param {string[]} followerUUIDs - The UUIDs of the desired followers.
@param {string[]} allowStatuses - The allowed statuses for the connection.
@param {Object[]} [connection_geometries=[]] - The connection geometries for the connections.
@returns {Promise} A promise that resolves when all connection creations are completed.
*/
async function connectAgents(leaderUUID, followerUUIDs, allowStatuses, connection_geometries = [])  {

	const leader = await agents.get('uuid', leaderUUID, ['id', 'uuid'], null, ['follower_connections']);
	const currentFollowersIds = leader[0].follower_connections.map(e => parseInt(e.id));
	const desiredFollowersIds = await agents.getIds(followerUUIDs);

	const difference = (array1, array2) => array1.length? array1.filter(e=>!array2.includes(e)):[];
	const disconnectIds = difference(currentFollowersIds, desiredFollowersIds);
	const newConnectedIds = difference(desiredFollowersIds, currentFollowersIds );

	let promises = [];
	disconnectIds.forEach(id => {
						promises.push(agents_interconnections.remove('follower_id', id));
						promises.push(agents.update_byId(id, {'rbmq_username':''}));
					});
	promises = promises.concat(newConnectedIds.map((id) => 
									agents_interconnections.insert({'leader_id':leader[0].id, 'follower_id':id }).then(()=>id)));
	
	return Promise.all(promises).then(() => desiredFollowersIds);
}


subscribeToDatabaseEvents = async (client, channelNames=[]) => {

    for (const channelName of channelNames) {
		const queryText = `LISTEN ${channelName}`;
		await client.query(queryText);
		console.log(`Subscribed to channel: ${channelName}`);
	}

}


const services = new DatabaseLayer(mainClient, 'public.services');
const service_requests = new DatabaseLayer(mainClient, 'public.service_requests');
const assignments = new DatabaseLayer(mainClient,'public.assignments');
const work_processes = new DatabaseLayer(mainClient, 'public.work_processes');
const mission_queue = new DatabaseLayer(mainClient, 'public.mission_queue');
const map_objects = new DatabaseLayer(mainClient, 'public.map_objects');
const sysLogs = new DatabaseLayer(mainClient, 'public.system_logs');
const targets = new DatabaseLayer(mainClient, 'public.targets');
const work_process_type = new DatabaseLayer(mainClient, 'public.work_process_type');
const work_process_service_plan = new DatabaseLayer(mainClient, 'public.work_process_service_plan');
const yards = new DatabaseLayer(mainClient, 'public.yards');
const agents_interconnections = new DatabaseLayer(mainClient, 'public.agents_interconnections');


module.exports.connectToDB = connectToDB;
module.exports.disconnectFromDB = disconnectFromDB;


module.exports.client = mainClient;
module.exports.pgNotifications = pgNotifications;
module.exports.shortTimeClient = shortTimeClient;
module.exports.getNewClient = getNewClient;

module.exports.map_objects = map_objects;
module.exports.agents = agents;
module.exports.agents_interconnections = agents_interconnections;
module.exports.targets = targets;
module.exports.work_processes = work_processes;
module.exports.mission_queue = mission_queue;
module.exports.assignments = assignments;
module.exports.service_requests = service_requests;
module.exports.services = services;
module.exports.work_process_type = work_process_type;
module.exports.work_process_service_plan = work_process_service_plan;
module.exports.yards = yards;
module.exports.sysLogs = sysLogs;
module.exports.connectAgents = connectAgents;
module.exports.subscribeToDatabaseEvents = subscribeToDatabaseEvents;

module.exports.updateAgentsConnectionStatus = (n_secs) => updateAgentsConnectionStatus(mainClient, n_secs);
module.exports.getUncompletedAssignments_byWPId = (wpId) => getUncompletedAssignments_byWPId(mainClient, 
																							 wpId,
																							 UNCOMPLETE_ASSIGNM_STATUSES);
module.exports.setDBTimeout = (n_secs) => setDBTimeout(shortTimeClient, n_secs);																					
module.exports.searchAllRelatedUncompletedAssignments = (assId) => searchAllRelatedUncompletedAssignments(shortTimeClient, 
																											assId, 
																											UNCOMPLETE_ASSIGNM_STATUSES);

