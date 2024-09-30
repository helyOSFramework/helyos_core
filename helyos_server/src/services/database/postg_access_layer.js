
// ----------------------------------------------------------------------------
// DATABASE INTERFACE CLASS 
// ----------------------------------------------------------------------------
const { Client } = require('pg');


/**
 * @function parseConditions
 * @param {Object} conditions - key-value pairs
 * @returns 
 */
const parseConditions = (tableName, conditions) => {
    let names = [], values = [], masks = [];
    let null_conditions = [], in_conditions = [];
    if (!conditions || Object.keys(conditions).length == 0) {
        return this.list();
    }


	let fromTableStatements = [];
	Object.keys(conditions).forEach((key, idx) => {

		if (key.includes('.')) {
			const [table, field] = key.split('.');
			if (  !tableName.includes(table) && !fromTableStatements.includes(table)) {
					fromTableStatements.push(table);
			}
		}
		
		if (key.endsWith('__in')) {
			if (!Array.isArray(conditions[key])) {
				throw new Error(`Invalid value for ${key}. Expected an array.`);
			}
            // Check if the array contains only numbers
            if (conditions[key].every(Number.isFinite)) {
                in_conditions.push(`AND ${key.slice(0, -4)} IN (${conditions[key].join(",")}) `);
            } else {
                in_conditions.push(`AND ${key.slice(0, -4)} IN ('${conditions[key].join("','")}') `);
            }
		} else if (conditions[key] === null) {
			null_conditions.push(`AND ${key} IS NULL `);
		} else {
			names.push(key);
			values.push(conditions[key]);
			masks.push('$' + (idx + 1));
		}
	});

    names = names.join(',');
    masks = masks.join(',');
	fromTableStatements = fromTableStatements.length > 0 ? ' FROM ' + fromTableStatements.join(', ') : '';	
    null_conditions = null_conditions.join(' ');
    in_conditions = in_conditions.join(' ');

    return { names, values, masks, null_conditions, in_conditions, fromTableStatements };
}

class DatabaseLayer {

	constructor(client, table, shortTimeClient = null, jsonFields=[]) {
		this.client = client;
		this.table = table;
		this.shortTimeClient = shortTimeClient;
		this.jsonFields = jsonFields;
	}

	_isEmptyObject(obj) {
		return obj && Object.keys(obj).length === 0 && obj.constructor === Object
	}

	insert(patch, useShortTimeClient = false) {
		let colNames = [], colValues = [], valueMasks = [];
		delete patch['id'];

		Object.keys(patch).forEach((key, idx) => {
			colNames.push(key);
			if (this.jsonFields.includes(key)) {
				colValues.push(JSON.stringify(patch[key]));
			} else {
				colValues.push(patch[key]);
			}
			valueMasks.push('$' + (idx + 1));
		});

		colNames = colNames.join(',');
		valueMasks = valueMasks.join(',');

		let queryText = 'INSERT INTO ' + this.table + '(' + colNames + ') VALUES (' + valueMasks + ') RETURNING id';

		const _client = useShortTimeClient ? this.shortTimeClient : this.client;

		return _client.query(queryText, colValues)
			.then((res) => { return res['rows'][0]['id'] });

	}

	list(useShortTimeClient = false) {
		const _client = useShortTimeClient ? this.shortTimeClient : this.client;

		return _client.query('SELECT * FROM ' + this.table + ' ')
			.then((res) => { return res['rows'] });
	}

	list_in(key, listArgs, orderBy = null, useShortTimeClient = false) {
		if (!listArgs || listArgs.length === 0) { return Promise.resolve([]); }
		let orderByStr = orderBy ? `ORDER BY ${orderBy}` : '';
		let values = listArgs.map(e => `'${e}'`);
		values.join(', ');

		const _client = useShortTimeClient ? this.shortTimeClient : this.client;

		return _client.query("SELECT * FROM " + this.table + " WHERE " + key + " IN  (" + values + ")" + orderByStr)
			.then((res) => { return res['rows'] });
	}

	get(key, value, items = [], orderBy = null, useShortTimeClient = false) {
		let colNames;
		let orderByStr;

		if (items === undefined || items.length == 0)
			colNames = '*';
		else
			colNames = items.join(',');

		if (orderBy)
			orderByStr = `ORDER BY ${orderBy}`;
		else
			orderByStr = '';

		const _client = useShortTimeClient ? this.shortTimeClient : this.client;

		return _client.query('SELECT ' + colNames + ' FROM ' + this.table + ' WHERE ' + key + '= $1' + orderByStr, [value])
			.then((res) => { return res['rows'] });
	}

	get_byId(id, items, useShortTimeClient = false) {
		return this.get('id', id, items, null, useShortTimeClient)
			.then((res) => { return res[0] });
	}


	select(conditions, items = [], orderBy = '', useShortTimeClient = false) {
		let selColNames = [];
		let orderByStr;
		if (!conditions || Object.keys(conditions).length == 0) {
			return this.list(useShortTimeClient);
		}

		if (items === undefined || items.length == 0)
			selColNames = '*';
		else
			selColNames = items.join(',');

		const {names, values, masks, null_conditions, in_conditions, fromTableStatements} = parseConditions(this.table, conditions);
		const colNames = names, colValues = values, valueMasks = masks;

		if (orderBy)
			orderByStr = `ORDER BY ${orderBy}`;
		else
			orderByStr = '';

		let queryText;

		if (Object.keys(conditions).length > 1) {
			queryText = 'SELECT ' + selColNames + ' FROM ' + this.table + ' WHERE (' + colNames + ') = (' + valueMasks + ')' + null_conditions + in_conditions + orderByStr;
		} else {
			queryText = 'SELECT ' + selColNames + ' FROM ' + this.table + ' WHERE ' + colNames + ' = ' + valueMasks + null_conditions + in_conditions + orderByStr;
		}

		const _client = useShortTimeClient ? this.shortTimeClient : this.client;

		return _client.query(queryText, colValues)
			.then((res) => res['rows']);
	}



	update(name, value, patch, useShortTimeClient = false) {
		const _client = useShortTimeClient ? this.shortTimeClient : this.client;
		if (this._isEmptyObject(patch)) {
			return Promise.resolve({})
		}
		let colNames = [], colValues = [], valueMasks = [];
		delete patch['id'];

		Object.keys(patch).forEach((key, idx) => {
			colNames.push(key);
			if (this.jsonFields.includes(key)) {
				colValues.push(JSON.stringify(patch[key]));
			} else {
				colValues.push(patch[key]);
			}
			
			valueMasks.push('$' + (idx + 1));
		});

		colNames = colNames.join(',');
		valueMasks = valueMasks.join(',');

		const filterMask = '$' + (Object.keys(patch).length + 1);
		colValues.push(value);

		let queryText;

		if (Object.keys(patch).length > 1) {
			queryText = 'UPDATE ' + this.table + ' SET (' + colNames + ') = (' + valueMasks + ')  WHERE ' + name + ' = ' + filterMask + ' ';
		} else {
			queryText = 'UPDATE ' + this.table + ' SET ' + colNames + ' = ' + valueMasks + '  WHERE ' + name + ' = ' + filterMask + ' ';
		}

		return _client.query(queryText, colValues)
			.then((res) => patch);
	}


	updateByConditions(conditions, patch, useShortTimeClient = false) {
		if (this._isEmptyObject(patch) || this._isEmptyObject(conditions)) {
			return Promise.resolve({})
		}

		const {names, values, masks, null_conditions, in_conditions, fromTableStatements} = parseConditions(this.table, conditions);
		const condColNames = names, condColValues = values, condValueMasks = masks;	

		let colNames = [], colValues = [...condColValues], valueMasks = [];
		delete patch['id'];

		Object.keys(patch).forEach((key, idx) => {
			colNames.push(key);
			if (this.jsonFields.includes(key)) {
				colValues.push(JSON.stringify(patch[key]));
			} else {
				colValues.push(patch[key]);
			}
			valueMasks.push('$' + (idx + 1 + condColValues.length));
		});

		colNames = colNames.join(',');
		valueMasks = valueMasks.join(',');

		let queryText, patchString ;
		if (Object.keys(patch).length === 1)  {
			patchString = colNames + ' = ' + valueMasks;
		} else {
			patchString = '(' + colNames + ') = (' + valueMasks + ')';
		}


		if (Object.keys(conditions).length > 1) {
			queryText = 'UPDATE ' +  this.table + ' SET ' + patchString + fromTableStatements + ' WHERE (' + condColNames + ') = (' + condValueMasks + ')' + null_conditions + in_conditions ;
		} else {
			queryText = 'UPDATE ' + this.table + ' SET ' + patchString + fromTableStatements + '  WHERE ' + condColNames + ' = ' + condValueMasks + null_conditions + in_conditions;
		}

		const _client = useShortTimeClient ? this.shortTimeClient : this.client;

		return _client.query(queryText, colValues)
			   .then((res) => res.rowCount);
	}


	
	updateMany(patchArray, index, useShortTimeClient = false) {
	//  POSTGRES LIMITATION: cannot insert multiple updates into a single query statement
		const promisseList = patchArray.map(patch => {
			delete patch.time_stamp;
			if (Object.keys(patch).length < 2) return Promise.resolve({});
			else return this.update(index, patch[index], patch, useShortTimeClient)
						.catch(e => {
							return { error: e, failedIndex: patch[index] } 
						});
		});

		return Promise.all(promisseList);

		// return this.client.query('BEGIN').then(()=>Promise.all(queriePromises))
		// 		   .then((r)=>this.client.query('COMMIT').then(()=>r))
		// 		   .catch((e)=> this.client.query('ROLLBACK').then(()=>{throw e}));
	}


	//updateMany function delayed by X seconds to test system resilience
	updateManyDelayed(patchArray, index, useShortTimeClient = false) {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				this.updateMany(patchArray, index, useShortTimeClient)
					.then((r) => resolve(r))
					.catch((e) => reject(e));
			}, 1000);
		});
	}



	insertMany(dataArray, useShortTimeClient = false) {
		if (dataArray.length === 0) { return Promise.resolve([]) };

		// Collect all unique column names across all objects
		const columnNames = new Set();
		dataArray.forEach((data) => {
			Object.keys(data).forEach((key) => {
				columnNames.add(key);
			});
		});

		const insertValues = [];
		dataArray.forEach((data) => {
			const values = Array.from(columnNames).map((col) => {
				if (data[col] === undefined) return null;
				if (Array.isArray(data[col])) return JSON.stringify(data[col]);
				return data[col];
			});
			insertValues.push(values);
		});

		// Construct the SQL query
		const queryText = `
		INSERT INTO ${this.table}(${Array.from(columnNames).join(', ')})
		VALUES
		${dataArray.map((_, i) => {
			const placeholders = Array.from(columnNames).map((_, j) => `$${i * columnNames.size + j + 1}`).join(', ');
			return `(${placeholders})`;
		}).join(',\n')}
		RETURNING id
		`;
	
		const queryValues = insertValues.flat();

		const _client = useShortTimeClient ? this.shortTimeClient : this.client;
	
		return _client.query(queryText, queryValues);

	}




	update_byId(id, patch, useShortTimeClient = false) {
		return this.update('id', id, patch, useShortTimeClient)
			.then((res) => { return res });
	}


	delete(conditions, useShortTimeClient = false) {
		let colNames = [], colValues = [], valueMasks = [];
		let null_conditions = [];
		if (!conditions || Object.keys(conditions).length == 0) {
			return this.list(useShortTimeClient);
		}

		Object.keys(conditions).forEach((key, idx) => {
			if (conditions[key] === null) {
				null_conditions.push(`AND ${key} IS NULL `);
			} else {
				colNames.push(key);
				colValues.push(conditions[key]);
				valueMasks.push('$' + (idx + 1));
			}
		});

		colNames = colNames.join(',');
		valueMasks = valueMasks.join(',');
		null_conditions = null_conditions.join(' ');

		let queryText;

		if (Object.keys(conditions).length > 1) {
			queryText = 'DELETE  FROM ' + this.table + ' WHERE (' + colNames + ') = (' + valueMasks + ')' + null_conditions ;
		} else {
			queryText = 'DELETE  FROM ' + this.table + ' WHERE ' + colNames + ' = ' + valueMasks + null_conditions;
		}

		const _client = useShortTimeClient ? this.shortTimeClient : this.client;

		return _client.query(queryText, colValues)
			.then((res) => res['rows'])
			.catch(e => {
				console.log(e);
				throw Error(e);
			});
	}



	deleteByIds(ids, useShortTimeClient = false) {
		if (ids.length === 0) { return Promise.resolve([]) }
		let valueMasks = [];
		ids.forEach((id, idx) => valueMasks.push('$' + (idx + 1)));
		valueMasks = valueMasks.join(',');

		const _client = useShortTimeClient ? this.shortTimeClient : this.client;

		return _client.query(`DELETE FROM ${this.table} WHERE id in  (${valueMasks} )`, ids)
			.then((res) => res['rows'])
			.catch(e => {
				console.log(e);
				throw Error(e);
			});
	}

	remove(key, value, useShortTimeClient = false) {
		const _client = useShortTimeClient ? this.shortTimeClient : this.client;

		return _client.query('DELETE FROM ' + this.table + ' WHERE ' + key + '=' + value + ' ')
			.then((res) => res)
			.catch(e => {
				console.log(e);
			});
	}


	remove_byId(id, useShortTimeClient = false) {
		return this.remove('id', id, useShortTimeClient)
			.then((res) => { return res });
	}

}


class AgentDataLayer extends DatabaseLayer {
	constructor(client, shortTimeClient = null, jsonFields=[]) {
		super(client, 'public.agents', shortTimeClient, jsonFields);
	}


	getUuids(ids = []) {
		if (ids.length === 0) { return Promise.resolve([]) }
		let valueMasks = [];
		ids.forEach((id, idx) => valueMasks.push('$' + (idx + 1)));
		valueMasks = valueMasks.join(',');
		return this.client.query(`SELECT uuid FROM public.agents WHERE id in  (${valueMasks} )`, ids)
			.then((res) => res['rows'].map(t => t.uuid));
	}

	getIds(uuids = []) {
		if (uuids.length === 0) { return Promise.resolve([]) }
		let valueMasks = [];
		uuids.forEach((uuid, idx) => valueMasks.push('$' + (idx + 1)));
		valueMasks = valueMasks.join(',');
		return this.client.query(`SELECT id FROM public.agents WHERE uuid in  (${valueMasks} )`, uuids)
			.then((res) => res['rows'].map(t => parseInt(t.id)));
	}


	get(key, value, items, orderBy = null, nestedFields = null) {
		let colNames;
		let orderByStr;
		let followerInterconnectionsFlag = nestedFields &&  nestedFields.includes('follower_connections');
		let leaderInterconnectionsFlag = nestedFields && nestedFields.includes('leader_connections');

		if (items === undefined || items.length == 0)
			colNames = '*';
		else {
			items = items.filter(i => (!('leader_interconnections','follower_connections').includes(i)  ));
			colNames = items.join(',');
		}

		if (orderBy)
			orderByStr = `ORDER BY ${orderBy}`;
		else
			orderByStr = '';

		return this.client.query('SELECT ' + colNames + ' FROM ' + this.table + ' WHERE ' + key + '= $1' + orderByStr, [value])
			.then((res) => {
				let aggregatePromises;
				if (!followerInterconnectionsFlag && !leaderInterconnectionsFlag) 
					{ return res['rows'] };

				if (followerInterconnectionsFlag && !leaderInterconnectionsFlag) 
					{aggregatePromises = this.aggregatedFollowerConnections.bind(this)};

				if (!followerInterconnectionsFlag && leaderInterconnectionsFlag) 
					{aggregatePromises = this.aggregatedLeaderConnections.bind(this)};

				if (followerInterconnectionsFlag && leaderInterconnectionsFlag ){
					{aggregatePromises = (a) => this.aggregatedFollowerConnections(a).bind(this)
												.then( a => this.aggregatedLeaderConnections(a).bind(this))};
				}

				const agents = res['rows'];
				const promiseArray = agents.map(t => aggregatePromises(t));
				return Promise.all(promiseArray);
			});

	}


	aggregatedFollowerConnections(agent) {
		return this.client.query(`
		SELECT A.id, A.uuid, A.geometry, A.yard_id, B.connection_geometry FROM public.agents as A 
		JOIN public.agents_interconnections as B 
		ON A.id = B.follower_id
		WHERE A.id IN  (SELECT follower_id FROM  public.agents_interconnections WHERE leader_id = $1) 
		`, [agent.id])
			.then(res => ({ ...agent, follower_connections: res['rows'] }));
	}

	aggregatedLeaderConnections(agent) {
		return this.client.query(`
		SELECT A.id, A.uuid, A.geometry, A.yard_id, B.connection_geometry FROM public.agents as A 
		JOIN public.agents_interconnections as B 
		ON A.id = B.leader_id
		WHERE A.id IN  (SELECT leader_id FROM  public.agents_interconnections WHERE follower_id = $1) 
		`, [agent.id])
			.then(res => ({ ...agent, leader_connections: res['rows'] }));
	}


}

const setDBTimeout = (client, mlSeconds) => {
	const queryText = `SET statement_timeout = '${mlSeconds}'`;
	return client.query(queryText);
}

const updateAgentsConnectionStatus = (client, n_secs) => {
	const strSeconds = ` INTERVAL '${n_secs} seconds'`;
	const sqlString1 = `UPDATE public.agents SET connection_status = $1 WHERE (connection_status = $2) and (last_message_time <  (now() - ${strSeconds}));`;
	const sqlString2 = `UPDATE public.agents SET connection_status = $1, msg_per_sec = 0 WHERE (connection_status = $2) and (last_message_time >=  (now() - ${strSeconds}));`;
	const onlineToOffline = client.query(sqlString1, ['offline', 'online']);
	const offlineToOnline = client.query(sqlString2, ['online', 'offline']);
	return Promise.allSettled([onlineToOffline, offlineToOnline]);
}


const getUncompletedAssignments_byWPId = (client, wpId, uncompletedAssgmStatus) => {
	return client.query('SELECT id, service_request_id FROM public.assignments WHERE work_process_id =  $1 AND status IN ($2, $3, $4, $5, $6)', [wpId, ...uncompletedAssgmStatus])
		.then((res) => res['rows']);
}


const searchAllRelatedUncompletedAssignments = (client, assId, uncompletedAssgmStatus) => {
	return client.query('SELECT id FROM public.assignments WHERE work_process_id in (SELECT work_process_id FROM public.assignments WHERE id = $1) AND status IN ($2, $3, $4, $5, $6)',
						 [assId, ...uncompletedAssgmStatus]).then((res) => res['rows']);
}



const wait_database_value = (dataLayerInstance, id, field, value, maxTries, debug = false) => {
	const { log } = require('console');

	function checkValue(dataLayerInstance, id, field, value) {
		return dataLayerInstance.get_byId(id).then(resp => {
			if (field == 'status' && debug) {
				if (!resp) { log(`${value} <=> null`) }
				else { log(`${value} <=> ${resp[field]}`) }
			}

			return (resp && (resp[field] == value))
		})
	}

	return new Promise((resolve, reject) => {
		let tries = 1;
		const watcher = setInterval(async () => {
			if (await checkValue(dataLayerInstance, id, field, value)) {
				clearInterval(watcher);
				resolve(true);
			}
			tries += 1;
			if (tries > maxTries) {
				clearInterval(watcher);
				resolve(false);
			}
		}, 1000);
	});
}


const wait_database_query = (dataLayerInstance, conditions, maxTries) => {

	function checkValue(dataLayerInstance, conditions) {
		return dataLayerInstance.select(conditions).then(resp => (resp && (resp.length > 0)))
	}

	return new Promise((resolve, reject) => {
		let tries = 1;
		const watcher = setInterval(async () => {
			if (await checkValue(dataLayerInstance, conditions)) {
				clearInterval(watcher);
				resolve(true);
			}
			tries += 1;
			if (tries > maxTries) {
				clearInterval(watcher);
				resolve(false);
			}
		}, 1000);
	});
}



module.exports.DatabaseLayer = DatabaseLayer;
module.exports.AgentDataLayer = AgentDataLayer;
module.exports.Client = Client;
module.exports.wait_database_value = wait_database_value;
module.exports.wait_database_query = wait_database_query;
module.exports.setDBTimeout = setDBTimeout;

module.exports.updateAgentsConnectionStatus = updateAgentsConnectionStatus;
module.exports.getUncompletedAssignments_byWPId = getUncompletedAssignments_byWPId;
module.exports.searchAllRelatedUncompletedAssignments = searchAllRelatedUncompletedAssignments;