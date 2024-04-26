
// ----------------------------------------------------------------------------
// DATABASE INTERFACE CLASS 
// ----------------------------------------------------------------------------
const { Client } = require('pg');


/**
 * @function parseConditions
 * @param {Object} conditions - key-value pairs
 * @returns 
 */
const parseConditions = (conditions) => {
    let names = [], values = [], masks = [];
    let null_conditions = [], in_conditions = [];
    if (!conditions || Object.keys(conditions).length == 0) {
        return this.list();
    }

	Object.keys(conditions).forEach((key, idx) => {
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
    null_conditions = null_conditions.join(' ');
    in_conditions = in_conditions.join(' ');

    return { names, values, masks, null_conditions, in_conditions };
}

class DatabaseLayer {

	constructor(client, table) {
		this.client = client;
		this.table = table;
	}

	_isEmptyObject(obj) {
		return obj && Object.keys(obj).length === 0 && obj.constructor === Object
	}

	insert(patch) {
		let colNames = [], colValues = [], valueMasks = [];
		delete patch['id'];

		Object.keys(patch).forEach((key, idx) => {
			colNames.push(key);
			colValues.push(patch[key]);
			valueMasks.push('$' + (idx + 1));
		});

		colNames = colNames.join(',');
		valueMasks = valueMasks.join(',');

		let queryText = 'INSERT INTO ' + this.table + '(' + colNames + ') VALUES (' + valueMasks + ') RETURNING id';

		return this.client.query(queryText, colValues)
			.then((res) => { return res['rows'][0]['id'] });

	}

	list() {
		return this.client.query('SELECT * FROM ' + this.table + ' ')
			.then((res) => { return res['rows'] });
	}

	list_in(key, listArgs, orderBy = null) {
		if (!listArgs || listArgs.length === 0) { return Promise.resolve([]); }
		let orderByStr = orderBy ? `ORDER BY ${orderBy}` : '';
		let values = listArgs.map(e => `'${e}'`);
		values.join(', ');
		return this.client.query("SELECT * FROM " + this.table + " WHERE " + key + " IN  (" + values + ")" + orderByStr)
			.then((res) => { return res['rows'] });
	}

	get(key, value, items = [], orderBy = null) {
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

		return this.client.query('SELECT ' + colNames + ' FROM ' + this.table + ' WHERE ' + key + '= $1' + orderByStr, [value])
			.then((res) => { return res['rows'] });
	}

	get_byId(id, items) {
		return this.get('id', id, items)
			.then((res) => { return res[0] });
	}


	select(conditions, items = [], orderBy = '') {
		let selColNames = [];
		let orderByStr;
		if (!conditions || Object.keys(conditions).length == 0) {
			return this.list();
		}

		if (items === undefined || items.length == 0)
			selColNames = '*';
		else
			selColNames = items.join(',');

		const {names, values, masks, null_conditions, in_conditions} = parseConditions(conditions);
		const colNames = names, colValues = values, valueMasks = masks;

		if (orderBy)
			orderByStr = `ORDER BY ${orderBy}`;
		else
			orderByStr = '';

		let queryText;

		if (Object.keys(conditions).length > 1) {
			queryText = 'SELECT ' + selColNames + ' FROM ' + this.table + ' WHERE (' + colNames + ') = (' + valueMasks + ')' + null_conditions + orderByStr;
		} else {
			queryText = 'SELECT ' + selColNames + ' FROM ' + this.table + ' WHERE ' + colNames + ' = ' + valueMasks + null_conditions + orderByStr;
		}
		return this.client.query(queryText, colValues)
			.then((res) => res['rows'])
			.catch(e => {
				console.log(e);
				throw Error(e);
			});
	}



	update(name, value, patch) {
		if (this._isEmptyObject(patch)) {
			return Promise.resolve({})
		}
		let colNames = [], colValues = [], valueMasks = [];
		delete patch['id'];

		Object.keys(patch).forEach((key, idx) => {
			colNames.push(key);
			colValues.push(patch[key]);
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
		return this.client.query(queryText, colValues)
			.then((res) => patch)
			.catch(e => {
				console.log(e);
			})
	}


	updateByConditions(conditions, patch) {
		if (this._isEmptyObject(patch) || this._isEmptyObject(conditions)) {
			return Promise.resolve({})
		}

		const {names, values, masks, null_conditions, in_conditions} = parseConditions(conditions);
		const condColNames = names, condColValues = values, condValueMasks = masks;	

		let colNames = [], colValues = [...condColValues], valueMasks = [];
		delete patch['id'];

		console.log('colValues', colValues);
		Object.keys(patch).forEach((key, idx) => {
			colNames.push(key);
			colValues.push(patch[key]);
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
			queryText = 'UPDATE ' +  this.table + ' SET ' + patchString + ' WHERE (' + condColNames + ') = (' + condValueMasks + ')' + null_conditions + in_conditions ;
		} else {
			queryText = 'UPDATE ' + this.table + ' SET ' + patchString + '  WHERE ' + condColNames + ' = ' + condValueMasks + null_conditions + in_conditions;
		}

		return this.client.query(queryText, colValues)
				.then((res) => res.rowCount)
				.catch(e => {
					console.log(e);
				});
	}


	
	updateMany(patchArray, index) {
	//  POSTGRES LIMITATION: cannot insert multiple updates into a single query statement
		const queriePromises = patchArray.map(patch => {
			delete patch.time_stamp;
			if (Object.keys(patch).length < 2) return Promise.resolve({});
			else return this.update(index, patch[index], patch).catch(r => ({ error: r, failedIndex: patch[index] }));
		});

		return Promise.all(queriePromises);

		// return this.client.query('BEGIN').then(()=>Promise.all(queriePromises))
		// 		   .then((r)=>this.client.query('COMMIT').then(()=>r))
		// 		   .catch((e)=> this.client.query('ROLLBACK').then(()=>{throw e}));
	}


	//updateMany function delayed by X seconds to test system resilience
	updateManyDelayed(patchArray, index) {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				this.updateMany(patchArray, index)
					.then((r) => resolve(r))
					.catch((e) => reject(e));
			}, 1000);
		});
	}



	insertMany(dataArray) {
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
	
		return this.client.query(queryText, queryValues);

	}




	update_byId(id, patch) {
		return this.update('id', id, patch)
			.then((res) => { return res });
	}


	delete(conditions) {
		let colNames = [], colValues = [], valueMasks = [];
		let null_conditions = [];
		if (!conditions || Object.keys(conditions).length == 0) {
			return this.list();
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
		return this.client.query(queryText, colValues)
			.then((res) => res['rows'])
			.catch(e => {
				console.log(e);
				throw Error(e);
			});
	}



	deleteByIds(ids) {
		if (ids.length === 0) { return Promise.resolve([]) }
		let valueMasks = [];
		ids.forEach((id, idx) => valueMasks.push('$' + (idx + 1)));
		valueMasks = valueMasks.join(',');
		return this.client.query(`DELETE FROM ${this.table} WHERE id in  (${valueMasks} )`, ids)
			.then((res) => res['rows'])
			.catch(e => {
				console.log(e);
				throw Error(e);
			});
	}

	remove(key, value) {
		return this.client.query('DELETE FROM ' + this.table + ' WHERE ' + key + '=' + value + ' ')
			.then((res) => res)
			.catch(e => {
				console.log(e);
			});
	}


	remove_byId(id) {
		return this.remove('id', id)
			.then((res) => { return res });
	}

}


class AgentDataLayer extends DatabaseLayer {
	constructor(client) {
		super(client, 'public.agents');
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
		let aggregateInterconnections = nestedFields && nestedFields.includes('interconnections');

		if (aggregateInterconnections) {
			items = items.filter(i => i !== 'interconnections');
		}

		if (items === undefined || items.length == 0)
			colNames = '*';
		else {
			colNames = items.join(',');
		}

		if (orderBy)
			orderByStr = `ORDER BY ${orderBy}`;
		else
			orderByStr = '';

		return this.client.query('SELECT ' + colNames + ' FROM ' + this.table + ' WHERE ' + key + '= $1' + orderByStr, [value])
			.then((res) => {
				if (!aggregateInterconnections) { return res['rows'] }
				const agents = res['rows'];
				const promiseArray = agents.map(t => this.aggregatedInterconnections(t));
				return Promise.all(promiseArray);
			});

	}


	aggregatedInterconnections(agent) {
		return this.client.query(`
		SELECT A.id, A.uuid, A.geometry, B.connection_geometry FROM public.agents as A 
		JOIN public.agents_interconnections as B 
		ON A.id = B.follower_id
		WHERE A.id IN  (SELECT follower_id FROM  public.agents_interconnections WHERE leader_id = $1) 
		`, [agent.id])
			.then(res => ({ ...agent, interconnections: res['rows'] }));
	}

}


const updateAgentsConnectionStatus = (client, n_secs) => {
	const strSeconds = ` INTERVAL '${n_secs} seconds'`;
	const sqlString1 = `UPDATE public.agents SET connection_status = $1 WHERE (connection_status = $2) and (last_message_time <  (now() - ${strSeconds}));`;
	const sqlString2 = `UPDATE public.agents SET connection_status = $1, msg_per_sec = 0 WHERE (connection_status = $2) and (last_message_time >=  (now() - ${strSeconds}));`;
	const onlineToOffline = client.query(sqlString1, ['offline', 'online']);
	const offlineToOnline = client.query(sqlString2, ['online', 'offline']);
	return Promise.all([onlineToOffline, offlineToOnline]);
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



module.exports.updateAgentsConnectionStatus = updateAgentsConnectionStatus;
module.exports.getUncompletedAssignments_byWPId = getUncompletedAssignments_byWPId;
module.exports.searchAllRelatedUncompletedAssignments = searchAllRelatedUncompletedAssignments;