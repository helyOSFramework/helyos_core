// ----------------------------------------------------------------------------
// DATABASE INTERFACE CLASS
// ----------------------------------------------------------------------------
import { Client } from 'pg';

/**
 * @function parseConditions
 * @param {Object} conditions - key-value pairs
 * @returns
 */
const parseConditions = (tableName:string, conditions:any) => {
    const namesArray: string[] = [];
    const values: string[] = [];
    const masksArray: string[] = [];
    const null_conditionsArray: string[] = [];
    const in_conditionsArray: string | string[] = [];

    if (!conditions || Object.keys(conditions).length === 0) {
        return {};
    }

    const fromTableStatementsArray: string[] = [];

    const notNullConditions = {};
    Object.keys(conditions).forEach((key, _idx) => {
        if (conditions[key] === null) {
            null_conditionsArray.push(` AND ${key} IS NULL `);
        } else {
            notNullConditions[key] = conditions[key];
        }
    });

    Object.keys(notNullConditions).forEach((key, idx) => {

        if (key.includes('.')) {
            const [table, field] = key.split('.');
            if (!tableName.includes(table) && !fromTableStatementsArray.includes(table)) {
                fromTableStatementsArray.push(table);
            }
        }

        if (key.endsWith('__in')) {
            if (!Array.isArray(conditions[key])) {
                throw new Error(`Invalid value for ${key}. Expected an array.`);
            }
            // Check if the array contains only numbers
            if (conditions[key].every(Number.isFinite)) {
                in_conditionsArray.push(`AND ${key.slice(0, -4)} IN (${conditions[key].join(",")}) `);
            } else {
                in_conditionsArray.push(`AND ${key.slice(0, -4)} IN ('${conditions[key].join("','")}') `);
            }
        } else {
            namesArray.push(key);
            values.push(conditions[key]);
            masksArray.push('$' + (idx + 1));
        }
    });

    const names = namesArray.join(',');
    const masks = masksArray.join(',');
    const fromTableStatements = fromTableStatementsArray.length > 0 ? ' FROM ' + fromTableStatementsArray.join(', ') : '';
    const null_conditions = null_conditionsArray.join(' ');
    const in_conditions = in_conditionsArray.join(' ');

    return {
        names,
        values,
        masks,
        null_conditions,
        in_conditions,
        fromTableStatements,
    };
};

class DatabaseLayer {
    client:Client;
    shortTimeClient?: Client;
    table: string;
    jsonFields: string[];

    constructor(client:Client, table:string, shortTimeClient?:Client, jsonFields?: string[]) {
        this.client = client;
        this.table = table;
        this.shortTimeClient = shortTimeClient;
        this.jsonFields = jsonFields? jsonFields : [];
    }

    _isEmptyObject(obj:any) {
        return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
    }

    insert(patch:any, useShortTimeClient = false) {
        const colNamesArray:string[] = []; const colValues: any[] = []; const valueMasksArray:string[] = [];
        delete patch['id'];

        Object.keys(patch).forEach((key, idx) => {
            colNamesArray.push(key);
            if (this.jsonFields.includes(key)) {
                colValues.push(JSON.stringify(patch[key]));
            } else {
                colValues.push(patch[key]);
            }
            valueMasksArray.push('$' + (idx + 1));
        });

        const colNames = colNamesArray.join(',');
        const valueMasks = valueMasksArray.join(',');

        const queryText = 'INSERT INTO ' + this.table + '(' + colNames + ') VALUES (' + valueMasks + ') RETURNING id';

        const _client = useShortTimeClient ? this.shortTimeClient : this.client;

        return _client!.query(queryText, colValues)
            .then((res) => {
                return res['rows'][0]['id'];
            });

    }

    list(useShortTimeClient = false) {
        const _client = useShortTimeClient ? this.shortTimeClient : this.client;

        return _client!.query('SELECT * FROM ' + this.table + ' ')
            .then((res) => {
                return res['rows'];
            });
    }

    list_in(key:string, listArgs: any[], orderBy:string = '', useShortTimeClient = false) {
        if (!listArgs || listArgs.length === 0) {
            return Promise.resolve([]);
        }
        const orderByStr = orderBy ? `ORDER BY ${orderBy}` : '';
        const values = listArgs.map(e => `'${e}'`);
        values.join(', ');

        const _client = useShortTimeClient ? this.shortTimeClient : this.client;

        return _client!.query("SELECT * FROM " + this.table + " WHERE " + key + " IN  (" + values + ")" + orderByStr)
            .then((res) => {
                return res['rows'];
            });
    }

    get(key, value, items: string[] = [], orderBy:string | null = null, useShortTimeClient = false) {
        let colNames;
        let orderByStr;

        if (items === undefined || items.length === 0) {
            colNames = '*';
        } else {
            colNames = items.join(',');
        }

        if (orderBy) {
            orderByStr = `ORDER BY ${orderBy}`;
        } else {
            orderByStr = '';
        }

        const _client = useShortTimeClient ? this.shortTimeClient : this.client;

        return _client!.query('SELECT ' + colNames + ' FROM ' + this.table + ' WHERE ' + key + '= $1' + orderByStr, [value])
            .then((res) => {
                return res['rows'];
            });
    }

    get_byId(id, items:string[]=[], useShortTimeClient = false) {
        return this.get('id', id, items, null, useShortTimeClient)
            .then((res) => {
                return res[0];
            });
    }

    select(conditions, items: string[] = [], orderBy = '', useShortTimeClient = false) {
        let selColNames: any = [];
        let orderByStr;
        if (!conditions || Object.keys(conditions).length === 0) {
            return this.list(useShortTimeClient);
        }

        if (items === undefined || items.length === 0) {
            selColNames = '*';
        } else {
            selColNames = items.join(',');
        }

        const {
            names, values, masks, null_conditions, in_conditions, fromTableStatements,
        } = parseConditions(this.table, conditions);
        const colNames = names; const colValues = values; const valueMasks = masks;

        if (orderBy) {
            orderByStr = `ORDER BY ${orderBy}`;
        } else {
            orderByStr = '';
        }

        let queryText;

        if (Object.keys(conditions).length > 1) {
            queryText = 'SELECT ' + selColNames + ' FROM ' + this.table + ' WHERE (' + colNames + ') = (' + valueMasks + ')' + null_conditions + in_conditions + orderByStr;
        } else {
            queryText = 'SELECT ' + selColNames + ' FROM ' + this.table + ' WHERE ' + colNames + ' = ' + valueMasks + null_conditions + in_conditions + orderByStr;
        }

        const _client = useShortTimeClient ? this.shortTimeClient : this.client;

        return _client!.query(queryText, colValues)
            .then((res) => res['rows']);
    }

    update(name:string, value:any, patch:any, useShortTimeClient = false) {
        const _client = useShortTimeClient ? this.shortTimeClient : this.client;
        if (this._isEmptyObject(patch)) {
            return Promise.resolve({});
        }
        const colNamesArray:string[] = []; const colValues:any[] = []; const valueMasksArray:string[] = [];
        delete patch['id'];

        Object.keys(patch).forEach((key, idx) => {
            colNamesArray.push(key);
            if (this.jsonFields.includes(key)) {
                colValues.push(JSON.stringify(patch[key]));
            } else {
                colValues.push(patch[key]);
            }

            valueMasksArray.push('$' + (idx + 1));
        });

        const colNames = colNamesArray.join(',');
        const valueMasks = valueMasksArray.join(',');

        const filterMask = '$' + (Object.keys(patch).length + 1);
        colValues.push(value);

        let queryText;

        if (Object.keys(patch).length > 1) {
            queryText = 'UPDATE ' + this.table + ' SET (' + colNames + ') = (' + valueMasks + ')  WHERE ' + name + ' = ' + filterMask + ' ';
        } else {
            queryText = 'UPDATE ' + this.table + ' SET ' + colNames + ' = ' + valueMasks + '  WHERE ' + name + ' = ' + filterMask + ' ';
        }

        return _client!.query(queryText, colValues)
            .then((res) => patch);
    }

    updateByConditions(conditions, patch, useShortTimeClient = false) {
        if (this._isEmptyObject(patch) || this._isEmptyObject(conditions)) {
            return Promise.resolve({});
        }

        const {
            names, values, masks, null_conditions, in_conditions, fromTableStatements,
        } = parseConditions(this.table, conditions);
        const condColNames = names; const condColValues = values; const condValueMasks = masks;

        const colNamesArray:string[] = []; const colValues = [...condColValues!]; const valueMasksArray:string[] = [];
        delete patch['id'];

        Object.keys(patch).forEach((key, idx) => {
            colNamesArray.push(key);
            if (this.jsonFields.includes(key)) {
                colValues.push(JSON.stringify(patch[key]));
            } else {
                colValues.push(patch[key]);
            }
            valueMasksArray.push('$' + (idx + 1 + condColValues!.length));
        });

        const colNames = colNamesArray.join(',');
        const valueMasks = valueMasksArray.join(',');

        let queryText; let patchString;
        if (Object.keys(patch).length === 1) {
            patchString = colNames + ' = ' + valueMasks;
        } else {
            patchString = '(' + colNames + ') = (' + valueMasks + ')';
        }

        if (Object.keys(conditions).length > 1) {
            queryText = 'UPDATE ' + this.table + ' SET ' + patchString + fromTableStatements + ' WHERE (' + condColNames + ') = (' + condValueMasks + ')' + null_conditions + in_conditions;
        } else {
            queryText = 'UPDATE ' + this.table + ' SET ' + patchString + fromTableStatements + '  WHERE ' + condColNames + ' = ' + condValueMasks + null_conditions + in_conditions;
        }

        const _client = useShortTimeClient ? this.shortTimeClient : this.client;

        return _client!.query(queryText, colValues)
            .then((res) => res.rowCount);
    }

    updateMany(patchArray, index, useShortTimeClient = false) {
    //  POSTGRES LIMITATION: cannot insert multiple updates into a single query statement
        const promisseList = patchArray.map(patch => {
            delete patch.time_stamp;
            if (Object.keys(patch).length < 2) {
                return Promise.resolve({});
            } else {
                return this.update(index, patch[index], patch, useShortTimeClient)
                    .catch(e => {
                        return {
                            error: e,
                            failedIndex: patch[index],
                        };
                    });
            }
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
        if (dataArray.length === 0) {
            return Promise.resolve([]);
        }

        // Collect all unique column names across all objects
        const columnNames = new Set();
        dataArray.forEach((data) => {
            Object.keys(data).forEach((key) => {
                columnNames.add(key);
            });
        });

        const insertValues: any[] = [];
        dataArray.forEach((data) => {
            const values: any[]= Array.from(columnNames).map((col:any) => {
                if (data[col] === undefined) {
                    return null;
                }
                if (Array.isArray(data[col])) {
                    return JSON.stringify(data[col]);
                }
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

        return _client!.query(queryText, queryValues)
            .then((res) => res['rows'].map(e => e.id))
            .catch(e => {
                console.error(e);
                throw Error(e);
            });

    }

    update_byId(id, patch, useShortTimeClient = false) {
        return this.update('id', id, patch, useShortTimeClient)
            .then((res) => {
                return res;
            });
    }

    delete(conditions, useShortTimeClient = false) {
        const colNamesArray:string[] = []; const colValues:string[] = []; const valueMasksArray:string[] = [];
        const null_conditionsArray:string[] = [];
        if (!conditions || Object.keys(conditions).length === 0) {
            return this.list(useShortTimeClient);
        }

        Object.keys(conditions).forEach((key, idx) => {
            if (conditions[key] === null) {
                null_conditionsArray.push(`AND ${key} IS NULL `);
            } else {
                colNamesArray.push(key);
                colValues.push(conditions[key]);
                valueMasksArray.push('$' + (idx + 1));
            }
        });

        const colNames = colNamesArray.join(',');
        const valueMasks = valueMasksArray.join(',');
        const null_conditions = null_conditionsArray.join(' ');

        let queryText;

        if (Object.keys(conditions).length > 1) {
            queryText = 'DELETE  FROM ' + this.table + ' WHERE (' + colNames + ') = (' + valueMasks + ')' + null_conditions;
        } else {
            queryText = 'DELETE  FROM ' + this.table + ' WHERE ' + colNames + ' = ' + valueMasks + null_conditions;
        }

        const _client = useShortTimeClient ? this.shortTimeClient : this.client;

        return _client!.query(queryText, colValues)
            .then((res) => res['rows'])
            .catch(e => {
                console.log(e);
                throw Error(e);
            });
    }

    deleteByIds(ids, useShortTimeClient = false) {
        if (ids.length === 0) {
            return Promise.resolve([]);
        }
        const valueMasksArray: string[] = [];
        ids.forEach((id, idx) => valueMasksArray.push('$' + (idx + 1)));
        const valueMasks = valueMasksArray.join(',');

        const _client = useShortTimeClient ? this.shortTimeClient : this.client;

        return _client!.query(`DELETE FROM ${this.table} WHERE id in  (${valueMasks} )`, ids)
            .then((res) => res['rows'])
            .catch(e => {
                console.log(e);
                throw Error(e);
            });
    }

    remove(key, value, useShortTimeClient = false) {
        const _client = useShortTimeClient ? this.shortTimeClient : this.client;

        return _client!.query('DELETE FROM ' + this.table + ' WHERE ' + key + '=' + value + ' ')
            .then((res) => res)
            .catch(e => {
                console.log(e);
            });
    }

    remove_byId(id, useShortTimeClient = false) {
        return this.remove('id', id, useShortTimeClient)
            .then((res) => {
                return res;
            });
    }

}

class AgentDataLayer extends DatabaseLayer {
    constructor(client, shortTimeClient:Client, jsonFields: string[] = []) {
        super(client, 'public.agents', shortTimeClient, jsonFields);
    }

    getUuids(ids: number[] = []) {
        if (ids.length === 0) {
            return Promise.resolve([]);
        }
        const valueMasksArray:string[] = [];
        ids.forEach((id, idx) => valueMasksArray.push('$' + (idx + 1)));
        const valueMasks = valueMasksArray.join(',');
        return this.client.query(`SELECT uuid FROM public.agents WHERE id in  (${valueMasks} )`, ids)
            .then((res) => res['rows'].map(t => t.uuid));
    }

    getIds(uuids: any[] = []) {
        if (uuids.length === 0) {
            return Promise.resolve([]);
        }
        const valueMasksArray:string[] = [];
        uuids.forEach((uuid, idx) => valueMasksArray.push('$' + (idx + 1)));
        const valueMasks = valueMasksArray.join(',');
        return this.client.query(`SELECT id FROM public.agents WHERE uuid in  (${valueMasks} )`, uuids)
            .then((res) => res['rows'].map(t => parseInt(t.id)));
    }

    get(key, value, items:string[]=[], orderBy = null, useShortTimeClient=false, nestedFields:string[]|null = null) {
        let colNames;
        let orderByStr;
        const followerInterconnectionsFlag = nestedFields && nestedFields.includes('follower_connections');
        const leaderInterconnectionsFlag = nestedFields && nestedFields.includes('leader_connections');

        if (items === undefined || items.length === 0) {
            colNames = '*';
        } else {
            items = items.filter(i => (!['leader_interconnections', 'follower_connections'].includes(i)));
            colNames = items.join(',');
        }

        if (orderBy) {
            orderByStr = `ORDER BY ${orderBy}`;
        } else {
            orderByStr = '';
        }

        return this.client.query('SELECT ' + colNames + ' FROM ' + this.table + ' WHERE ' + key + '= $1' + orderByStr, [value])
            .then((res) => {
                let aggregatePromises;
                if (!followerInterconnectionsFlag && !leaderInterconnectionsFlag) {
                    return res['rows'];
                }

                if (followerInterconnectionsFlag && !leaderInterconnectionsFlag) {
                    aggregatePromises = this.aggregatedFollowerConnections.bind(this);
                }

                if (!followerInterconnectionsFlag && leaderInterconnectionsFlag) {
                    aggregatePromises = this.aggregatedLeaderConnections.bind(this);
                }

                if (followerInterconnectionsFlag && leaderInterconnectionsFlag) {
                    {
                        aggregatePromises = (a) => this.aggregatedFollowerConnections.bind(this)(a)
                            .then(a => this.aggregatedLeaderConnections.bind(this)(a));
                    }
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
            .then(res => ({
                ...agent,
                follower_connections: res['rows'],
            }));
    }

    aggregatedLeaderConnections(agent) {
        return this.client.query(`
		SELECT A.id, A.uuid, A.geometry, A.yard_id, B.connection_geometry FROM public.agents as A 
		JOIN public.agents_interconnections as B 
		ON A.id = B.leader_id
		WHERE A.id IN  (SELECT leader_id FROM  public.agents_interconnections WHERE follower_id = $1) 
		`, [agent.id])
            .then(res => ({
                ...agent,
                leader_connections: res['rows'],
            }));
    }

}

const setDBTimeout = (client, mlSeconds) => {
    const queryText = `SET statement_timeout = '${mlSeconds}'`;
    return client.query(queryText);
};

const updateAgentsConnectionStatus = (client, n_secs) => {
    const strSeconds = ` INTERVAL '${n_secs} seconds'`;
    const sqlString1 = `UPDATE public.agents SET connection_status = $1 WHERE (connection_status = $2) and (last_message_time <  (now() - ${strSeconds}));`;
    const sqlString2 = `UPDATE public.agents SET connection_status = $1, msg_per_sec = 0 WHERE (connection_status = $2) and (last_message_time >=  (now() - ${strSeconds}));`;
    const onlineToOffline = client.query(sqlString1, ['offline', 'online']);
    const offlineToOnline = client.query(sqlString2, ['online', 'offline']);
    return Promise.allSettled([onlineToOffline, offlineToOnline]);
};

const getHighMsgRateAgents = (client, msgRateLimit, updtRateLimit) => {
    const sqlStringUpdtRate = `SELECT id, uuid, updt_per_sec, msg_per_sec FROM public.agents WHERE (connection_status = 'online') and (updt_per_sec >  $1);`;
    const sqlStringMsgRate = `SELECT id, uuid, updt_per_sec, msg_per_sec FROM public.agents WHERE (connection_status = 'online') and (msg_per_sec >  $1);`;
    const updtInfractors = client.query(sqlStringUpdtRate, [updtRateLimit]).then(rv => rv.rows);
    const msgInfractors = client.query(sqlStringMsgRate, [msgRateLimit]).then(rv => rv.rows);
    return Promise.all([msgInfractors, updtInfractors]).catch((e) => console.error(e));
};

const getUncompletedAssignments_byWPId = (client, wpId, uncompletedAssgmStatus) => {
    return client.query('SELECT id, service_request_id FROM public.assignments WHERE work_process_id =  $1 AND status IN ($2, $3, $4, $5, $6)', [wpId, ...uncompletedAssgmStatus])
        .then((res) => res['rows']);
};

const searchAllRelatedUncompletedAssignments = (client, assId, uncompletedAssgmStatus) => {
    return client.query('SELECT id FROM public.assignments WHERE work_process_id in (SELECT work_process_id FROM public.assignments WHERE id = $1) AND status IN ($2, $3, $4, $5, $6)',
        [assId, ...uncompletedAssgmStatus]).then((res) => res['rows']);
};

const wait_database_value = (dataLayerInstance, id, field, value, maxTries, debug = false) => {

    function checkValue(dataLayerInstance, id, field, value) {
        return dataLayerInstance.get_byId(id).then(resp => {
            if (field === 'status' && debug) {
                if (!resp) {
                    console.log(`${value} <=> null`);
                } else {
                    console.log(`${value} <=> ${resp[field]}`);
                }
            }

            return (resp && (resp[field] === value));
        });
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
};

const wait_database_query = (dataLayerInstance, conditions, maxTries) => {

    function checkValue(dataLayerInstance, conditions) {
        return dataLayerInstance.select(conditions).then(resp => (resp && (resp.length > 0)));
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
};

export {
    DatabaseLayer, AgentDataLayer, Client,
    wait_database_value, wait_database_query,
    setDBTimeout, updateAgentsConnectionStatus,
    getHighMsgRateAgents, getUncompletedAssignments_byWPId,
    searchAllRelatedUncompletedAssignments,
};

