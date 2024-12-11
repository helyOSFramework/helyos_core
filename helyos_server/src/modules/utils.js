/**
 * Converts a string to camel case.
 *
 * @param {string} text - The input string to camelize.
 * @returns {string} - The camelized string.
 */
const camelize = function (text) {
    return text.replace(/^([A-Z])|[\s-_]+(\w)/g, function (match, p1, p2, offset) {
        if (p2) return p2.toUpperCase();
        return p1.toLowerCase();
    });
}

/**
 * Checks if a value is a valid ISO date string.
 *
 * @param {string} value - The value to check.
 * @returns {boolean} - True if the value is a valid ISO date string, otherwise false.
 */
const isISODate = (value) => {
    const parsedDate = Date.parse(value);
    return !isNaN(parsedDate) && new Date(parsedDate).toISOString() === value;
}

/**
 * Serializes non-string values of an object to strings.
 *
 * @param {Object} obj - The object to serialize.
 * @returns {Object} - The serialized object with non-string values converted to strings.
 */
const serializeNonStringValues = (obj) => {
    const serializedObj = {};
    Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (typeof value === 'string') {
            serializedObj[key] = value;
        } else {
            if (typeof value === 'undefined') {
                serializedObj[key] = '';
            } else {
                serializedObj[key] = JSON.stringify(value);
            }
        }
    });
    return serializedObj;
}

/**
 * Parses the values of an object, converting them to appropriate types.
 *
 * @param {Object} object - The object with values to parse.
 * @returns {Object} - The object with parsed values.
 */
function parseObjectValues(object) {
    const parsedObject = {};

    for (const [key, value] of Object.entries(object)) {
        let parsedValue;

        try {
            parsedValue = JSON.parse(value);
        } catch (e) {
            // If JSON.parse fails, it's not a JSON string, so handle other cases
            if (value === 'true' || value === 'false') {
                parsedValue = value === 'true';
            } else if (!isNaN(value)) {
                parsedValue = Number(value);
            } else if (isISODate(value)) {
                parsedValue = new Date(value); // Handle datetime strings
            } else {
                parsedValue = value; // Keep it as a string
            }
        }

        parsedObject[key] = parsedValue;
    }

    return parsedObject;
}

/**
 * Converts the keys of an object to camel case.
 *
 * @param {Object} obj - The object with keys to camelize.
 * @returns {Object} - The new object with camelized keys.
 */
const camelizeAttributes = function (obj) {
    var newObject = {};
    for (var property in obj) {
        newObject[camelize(property)] = obj[property];
    }
    return newObject;
}

/**
 * Converts a string to snake case.
 *
 * @param {string} text - The input string to snakecasize.
 * @returns {string} - The snakecased string.
 */
const snakecasize = function (text) {
    return text && text.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
        .map(x => x.toLowerCase())
        .join('_')
}

/**
 * Converts a camel case string to snake case.
 *
 * @param {string} str - The camel case string to convert.
 * @returns {string} - The snake case string.
 */
const camelToSnakeCase = str => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

/**
 * Converts the keys of an object to snake case.
 *
 * @param {Object} obj - The object with keys to snakecasize.
 * @returns {Object} - The new object with snakecased keys.
 */
const snakeCaseAttributes = function (obj) {
    var newObject = {};
    for (var property in obj) {
        newObject[camelToSnakeCase(property)] = obj[property];
    }
    return newObject;
}

/**
 * Searches for a nested object by its key.
 *
 * @param {Object} obj - The object to search within.
 * @param {string} k - The key to search for.
 * @returns {any} - The value associated with the key, or null if not found.
 */
const lookup = (obj, k) => {
    try {
        // check if the input is an object
        if (typeof obj != "object") {
            return null;
        }
        let result = null;
        // check if the object has the key as a direct property
        if (obj.hasOwnProperty(k)) {
            return obj[k];
        } else {
            // otherwise, loop through the values of the object
            for (const o of Object.values(obj)) {
                // recursively call lookup on each value
                result = lookup(o, k);
                // if the result is not null, break the loop
                if (result == null) continue;
                else break;
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

/**
 * Calculates the topological order of a list of requests based on their dependencies.
 *
 * @param {Array<{ step: string, depends_on: Array<string> }>} requestList - The list of requests, where each request has a step and its dependencies.
 * @returns {Array<{ order: number, step: string, depends_on: Array<string> }>} - An array of requests with their calculated order.
 * @throws {Error} Throws an error if there are recursive dependencies in the request list.
 */
function topologicalIndexing(requestList = []) {
    const requestListIndexed = requestList.map(s => ({ 'order': 1, 'step': s.step, 'depends_on': s.depends_on }));
    const incrementDependentIndexes = (request, _requestListIndexed) => {
        let order = request.order;
        request['depends_on'].forEach(dependecy => {
            depState = _requestListIndexed.find(s => s.step === dependecy);
            if (depState && order <= depState.order) {
                order = depState.order + 1;
            }
        });
        return order;
    }

    let changeOrder = true;
    let recursiveDeps = false;
    let recursiveStep = '';
    while (changeOrder && !recursiveDeps) {
        changeOrder = false;
        for (const request of requestListIndexed) {
            const previousOrder = request.order;
            request.order = incrementDependentIndexes(request, requestListIndexed);
            changeOrder = changeOrder || previousOrder !== request.order;
            recursiveDeps = request.order > 2 * requestListIndexed.length;
            if (recursiveDeps) {
                recursiveStep = request.step;
                break;
            }
        };
    }

    if (recursiveDeps) {
        throw Error(`Dependencies are recursive: ${recursiveStep}`);
    }

    return requestListIndexed;
}


// const complexInput = [
//     { step: 'A', depends_on: [] },
//     { step: 'B', depends_on: [] },
//     { step: 'C', depends_on: ['A', ] },
//     { step: 'D', depends_on: ['B' ] },
//     { step: 'E', depends_on: ['D', 'A', 'C','H'] },
//     { step: 'F', depends_on: ['C'] },
//     { step: 'G', depends_on: [] },
//     { step: 'H', depends_on: ['G'] },
//     { step: 'I', depends_on: [] },
//     { step: 'J', depends_on: [] },
//   ];

//   const result = topologicalIndexing(complexInput);
// console.log(result);


module.exports.camelize = camelize;
module.exports.camelizeAttributes = camelizeAttributes;
module.exports.snakeCaseAttributes = snakeCaseAttributes;
module.exports.lookup = lookup;
module.exports.topologicalIndexing = topologicalIndexing;
module.exports.serializeNonStringValues = serializeNonStringValues;
module.exports.parseObjectValues = parseObjectValues;