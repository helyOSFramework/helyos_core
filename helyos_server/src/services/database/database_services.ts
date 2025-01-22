
// ----------------------------------------------------------------------------
// Postgres client setup 
// ----------------------------------------------------------------------------

import { UNCOMPLETE_ASSIGNM_STATUSES } from '../../modules/data_models';
import { DatabaseLayer, AgentDataLayer, Client, 
		searchAllRelatedUncompletedAssignments, getUncompletedAssignments_byWPId,
	     getHighMsgRateAgents, updateAgentsConnectionStatus, 
		 setDBTimeout } from './postg_access_layer';



class SingletonClient {
    private static instances: { [key: string]: Client } = {};

    static async getInstance(name: string, statementTimeout = 0): Promise<Client> {
        if (!this.instances[name]) {
            const client = new Client();
            await client.connect();
            if (statementTimeout > 0) {
                await client.query(`SET statement_timeout = ${statementTimeout}`);
            }
            console.log(`CREATE DATABASE CLIENT CONNECTION. STATEMENT_TIMEOUT=${statementTimeout} milliseconds`);
            this.instances[name] = client;
        }
        return this.instances[name];
    }

    static async disconnectAll() {
        const disconnectPromises = Object.values(this.instances).map(client => client.end());
        await Promise.all(disconnectPromises);
        this.instances = {};
    }
}

const subscribeToDatabaseEvents = async (client, channelNames: any[] = []) => {

	for (const channelName of channelNames) {
		const queryText = `LISTEN ${channelName}`;
		await client.query(queryText);
		console.log(`Subscribed to channel: ${channelName}`);
	}

}


const disconnectFromDB = async () => {
    await SingletonClient.disconnectAll();
};


async function createDatabaseService() {
    const mainClient = await SingletonClient.getInstance('mainClient');
    const shortTimeClient = await SingletonClient.getInstance('shortTimeClient', 1000);
    const pgNotifications = await SingletonClient.getInstance('pgNotifications');

	const agents = new AgentDataLayer(mainClient, shortTimeClient, ['geometry', 'factsheet']);
	const services = new DatabaseLayer(mainClient, 'public.services');
	const service_requests = new DatabaseLayer(mainClient, 'public.service_requests');
	const instant_actions = new DatabaseLayer(mainClient, 'public.instant_actions');
	const assignments = new DatabaseLayer(mainClient, 'public.assignments');
	const rbmq_config = new DatabaseLayer(mainClient, 'public.rbmq_config');
	const work_processes = new DatabaseLayer(mainClient, 'public.work_processes');
	const mission_queue = new DatabaseLayer(mainClient, 'public.mission_queue');
	const map_objects = new DatabaseLayer(mainClient, 'public.map_objects', shortTimeClient);
	const sysLogs = new DatabaseLayer(mainClient, 'public.system_logs');
	const targets = new DatabaseLayer(mainClient, 'public.targets');
	const work_process_type = new DatabaseLayer(mainClient, 'public.work_process_type');
	const work_process_service_plan = new DatabaseLayer(mainClient, 'public.work_process_service_plan');
	const yards = new DatabaseLayer(mainClient, 'public.yards');
	const agents_interconnections = new DatabaseLayer(mainClient, 'public.agents_interconnections');

	/**
	Connects the leader agent with the specified followers, disconnects any followers that are not desired,
	and inserts new connections for desired followers.
	@param {string} leaderUUID - The UUID of the leader agent.
	@param {string[]} followerUUIDs - The UUIDs of the desired followers.
	@param {Object[]} [connection_geometries=[]] - The connection geometries for the connections.
	@returns {Promise} A promise that resolves when all connection creations are completed.
	*/
	async function connectAgents(leaderUUID: string, followerUUIDs: string[] = [], connection_geometries = []) {

		const leader = await agents.get('uuid', leaderUUID, ['id', 'uuid'], null, false, ['follower_connections']);
		const currentFollowersIds = leader[0].follower_connections.map(e => parseInt(e.id));
		const desiredFollowersIds = await agents.getIds(followerUUIDs);

		const difference = (array1, array2) => array1.length ? array1.filter(e => !array2.includes(e)) : [];
		const disconnectIds = difference(currentFollowersIds, desiredFollowersIds);
		const newConnectedIds = difference(desiredFollowersIds, currentFollowersIds);

		let promises: Promise<any>[] = [];
		disconnectIds.forEach(id => {
			promises.push(agents_interconnections.remove('follower_id', id));
			promises.push(agents.update_byId(id, { 'rbmq_username': '' }));
		});
		promises = promises.concat(newConnectedIds.map((id) =>
			agents_interconnections.insert({ 'leader_id': leader[0].id, 'follower_id': id }).then(() => id)));

		return Promise.all(promises).then(() => desiredFollowersIds);
	}


	return {
		AgentDataLayer,
		client: mainClient,
		pgNotifications,
		shortTimeClient,
		map_objects,
		agents,
		instant_actions,
		rbmq_config,
		agents_interconnections,
		targets,
		work_processes,
		mission_queue,
		assignments,
		service_requests,
		services,
		work_process_type,
		work_process_service_plan,
		yards,
		sysLogs,
		connectAgents,
		subscribeToDatabaseEvents,
		updateAgentsConnectionStatus: (n_secs: number) => updateAgentsConnectionStatus(mainClient, n_secs),
		getHighMsgRateAgents: (msgRateLimit: number, updtRateLimit: number) =>
		getHighMsgRateAgents(mainClient, msgRateLimit, updtRateLimit),
		getUncompletedAssignments_byWPId: (wpId: number) =>
		getUncompletedAssignments_byWPId(mainClient, wpId, UNCOMPLETE_ASSIGNM_STATUSES),
		setDBTimeout: (n_secs: number) => setDBTimeout(shortTimeClient, n_secs),
		searchAllRelatedUncompletedAssignments: (assId: number) =>
		searchAllRelatedUncompletedAssignments(shortTimeClient, assId, UNCOMPLETE_ASSIGNM_STATUSES)
	};
}



// Singleton instance of the in-memory database.
let databaseService: any;
async function getInstance() {
	if (!databaseService) {
		console.log('====> Creating Database Service instance')
		databaseService = await createDatabaseService();
		console.log('====> Database Service created')
	}
	return databaseService;
}


  export { DatabaseLayer, AgentDataLayer, getInstance, disconnectFromDB };
  export default databaseService;
  

