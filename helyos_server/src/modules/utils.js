

// All fields of the database should be Camelized to match the GraphQL style

const camelize = function (text) {
    return text.replace(/^([A-Z])|[\s-_]+(\w)/g, function(match, p1, p2, offset) {
        if (p2) return p2.toUpperCase();
        return p1.toLowerCase();        
    });
}


const camelizeAttributes = function (obj) {
    var newObject = {};
    for (var property in obj) {
        newObject[camelize(property)]= obj[property];
    } 
    return newObject;
}


const snakecasize = function (text) {

    return text && text.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
                   .map(x => x.toLowerCase())
                   .join('_')
}


const camelToSnakeCase = str => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

const snakeCaseAttributes = function (obj) {
    var newObject = {};
    for (var property in obj) {
        newObject[camelToSnakeCase(property)]= obj[property];
    } 
    return newObject;
}


/*
lookup()
function to search for nested objects by their keys.
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
function topologicalIndexing(requestList=[]){
    const requestListIndexed = requestList.map( s => ({'order':1, 'step': s.step, 'depends_on': s.depends_on}))
    const incrementDependentIndexes = (request, _requestListIndexed) => {
        let order = request.order; 
        request['depends_on'].forEach(dependecy => {
            depState = _requestListIndexed.find( s => s.step === dependecy)           
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
            recursiveDeps = request.order > 2*requestListIndexed.length;
            if (recursiveDeps) {
                recursiveStep = request.step;
                break;                
            }   
        };
    }
    
    if (recursiveDeps){
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
