/**
 * Converts a string to camel case.
 */
const camelize = (text: string): string => {
    return text.replace(/^([A-Z])|[\s-_]+(\w)/g, (match: string, p1: string, p2: string) => {
        if (p2) return p2.toUpperCase();
        return p1.toLowerCase();
    });
};

/**
 * Checks if a value is a valid ISO date string.
 */
const isISODate = (value: string): boolean => {
    const parsedDate = Date.parse(value);
    return !isNaN(parsedDate) && new Date(parsedDate).toISOString() === value;
};

/**
 * Serializes non-string values of an object to strings.
 */
const serializeNonStringValues = (obj: Record<string, any>): Record<string, string> => {
    const serializedObj: Record<string, string> = {};
    Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (typeof value === 'string') {
            serializedObj[key] = value;
        } else if (typeof value === 'undefined') {
            serializedObj[key] = '';
        } else {
            serializedObj[key] = JSON.stringify(value);
        }
    });
    return serializedObj;
};

/**
 * Parses the values of an object, converting them to appropriate types.
 */
function parseObjectValues(object: Record<string, string>): Record<string, any> {
    const parsedObject: Record<string, any> = {};

    for (const [key, value] of Object.entries(object)) {
        let parsedValue: any;

        try {
            parsedValue = JSON.parse(value);
        } catch (e) {
            // If JSON.parse fails, it's not a JSON string, so handle other cases
            if (value === 'true' || value === 'false') {
                parsedValue = value === 'true';
            } else if (!isNaN(Number(value))) {
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
 */
const camelizeAttributes = (obj: any): Record<string, any> => {
    const newObject: Record<string, any> = {};
    for (const property in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, property)) {
            newObject[camelize(property)] = obj[property];
        }
    }
    return newObject;
};

/**
 * Converts a string to snake case.
 */
const snakecasize = (text: string): string => {
    return text && text.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
        ?.map(x => x.toLowerCase())
        .join('_') || '';
};

/**
 * Converts a camel case string to snake case.
 */
const camelToSnakeCase = (str: string): string => 
    str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

/**
 * Converts the keys of an object to snake case.
 */
const snakeCaseAttributes = <T extends Record<string, any>>(obj: T): Record<string, any> => {
    const newObject: Record<string, any> = {};
    for (const property in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, property)) {
            newObject[camelToSnakeCase(property)] = obj[property];
        }
    }
    return newObject;
};

/**
 * Searches for a nested object by its key.
 */
const lookup = (obj: Record<string, any>, k: string): any => {
    try {
        if (typeof obj !== "object" || obj === null) {
            return null;
        }
        
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
            return obj[k];
        }
        
        let result: any = null;
        for (const value of Object.values(obj)) {
            result = lookup(value, k);
            if (result !== null) break;
        }
        
        return result;
    } catch (error) {
        console.error(error);
        return null;
    }
};

interface Request {
    step: string;
    depends_on: string[];
}

interface IndexedRequest extends Request {
    order: number;
}

/**
 * Calculates the topological order of a list of requests based on their dependencies.
 */
function topologicalIndexing(requestList: Request[] = []): IndexedRequest[] {
    const requestListIndexed: IndexedRequest[] = requestList.map(s => ({
        order: 1,
        step: s.step,
        depends_on: s.depends_on
    }));

    const incrementDependentIndexes = (request: IndexedRequest, _requestListIndexed: IndexedRequest[]): number => {
        let order = request.order;
        request.depends_on.forEach(dependency => {
            const depState = _requestListIndexed.find(s => s.step === dependency);
            if (depState && order <= depState.order) {
                order = depState.order + 1;
            }
        });
        return order;
    };

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
        }
    }

    if (recursiveDeps) {
        throw new Error(`Dependencies are recursive: ${recursiveStep}`);
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


export {camelize, camelizeAttributes, snakeCaseAttributes, topologicalIndexing, lookup, serializeNonStringValues, parseObjectValues, snakecasize};