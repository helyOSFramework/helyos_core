import * as DatabaseService from '../services/database/database_services';

/**
 * Interface Definitions
 */
interface MapOrigin {
    long: number;
    lat: number;
    alt: number;
}

interface MapData {
    id: number;
    origin: MapOrigin;
    map_data?: any;
    data_format?: string;
    coordinate_frame?: string;
    map_objects?: any[];
}

class AgentCtxDTO {
    id: number;
    uuid: string;
    agent_class: string;
    agent_type: string;
    connection_status: string;
    reference_point: string;
    coordinate_frame: string;
    geometry: string;
    name: string;
    message_channel: string;
    public_key: string;
    is_actuator: boolean;
    data_format: string;
    yard_id: number;
    protocol: string;
    operation_types: string;
    factsheet: string;
    x: number;
    y: number;
    z: number;
    unit: string;
    orientations: any;
    sensors: any;
    resources: any;
    follower_connections?: any;
    pose?: {
        x: number;
        y: number;
        z: number;
        orientations: any;
    };

    constructor(agent: AgentCtxDTO) {
        Object.assign(this, agent);
        this.pose = {
            x: agent.x,
            y: agent.y,
            z: agent.z,
            orientations: agent.orientations,
        };
    }
    
}

interface Context {
    map: MapData;
    agents: AgentCtxDTO[];
}

interface Filter {
    require_map_data?: boolean;
    require_map_objects?: string[];
    require_agents_data?: boolean;
    require_mission_agents_data?: boolean;
    agent_ids?: number[];
}

interface ServiceRequest {
    request_uid: string;
    step: string;
    response?: {
        result?: any;
        results?: any;
    };
}

interface DependencyResult {
    requestUid: string;
    step: string;
    response: {
        result?: any;
        results?: any;
    };
}

/**
 * generateFullYardContext
 * Gathers all data relative to the yard.
 */
async function generateFullYardContext(yardId: number): Promise<Context> {
    const databaseServices = await DatabaseService.getInstance();
    const context: Context = {
        map: {} as MapData,
        agents: [],
    };

    context.map.id = yardId;

    const yard = await databaseServices.yards.get_byId(yardId, ['lon', 'lat', 'alt', 'map_data', 'data_format', 'coordinate_frame']);
    context.map.origin = {
        long: yard.lon,
        lat: yard.lat,
        alt: yard.alt,
    };
    context.map.map_data = yard.map_data;
    context.map.data_format = yard.data_format;
    context.map.coordinate_frame = yard.coordinate_frame;

    const mapObjects = await databaseServices.map_objects.select({ yard_id: yardId, deleted_at: null });
    context.map.map_objects = mapObjects;

    const agentFields = [
        'id', 'uuid', 'agent_class', 'agent_type', 'connection_status', 'reference_point', 'coordinate_frame',
        'geometry', 'name', 'message_channel', 'public_key', 'is_actuator', 'data_format','status',
        'yard_id', 'protocol', 'operation_types', 'factsheet', 'x', 'y', 'z', 'unit',
        'orientations', 'sensors', 'resources',
    ];
    const agents = await databaseServices.agents.get('yard_id', yardId, agentFields, null, false, ['follower_connections']);

    const agentCtx = agents.map(a => new AgentCtxDTO(a));

    context.agents = agentCtx;

    return context;
}

/**
 * Filters the generated context data according to the requirements of the requested service.
 */
function filterContext(context: Context, filter: Filter): Context {
    const filteredContext: Partial<Context> = {};

    if (filter.require_map_data) {
        filteredContext.map = context.map;
    }

    if (filter.require_map_objects) {
        if (filter.require_map_objects.length === 0) {
            filteredContext.map!.map_objects = [];
        } else {
            if (!filter.require_map_objects.includes('__all__')) {
                filteredContext.map!.map_objects = context.map.map_objects!.filter(mapObj =>
                    filter.require_map_objects!.includes(mapObj.type)
                );
            }
        }
    }

    if (filter.require_agents_data) {
        filteredContext.agents = context.agents;
    } else if (filter.require_mission_agents_data) {
        filteredContext.agents = context.agents.filter(agent =>
            filter.agent_ids!.some(id => id == agent.id)
        );
    }

    return filteredContext as Context;
}

/**
 * Generate dependencies for microservices.
 */
async function generateMicroserviceDependencies(servReqUids: string[]): Promise<DependencyResult[]> {
    const databaseServices = await DatabaseService.getInstance();
    const serviceRequests = await databaseServices.service_requests.list_in('request_uid', servReqUids);

    const dependencies = serviceRequests.map((serviceRequest: ServiceRequest) => {
        const dependencyResult: DependencyResult = {
            requestUid: serviceRequest.request_uid,
            step: serviceRequest.step,
            response: {},
        };

        if (serviceRequest.response) {
            dependencyResult.response = serviceRequest.response;
            if (serviceRequest.response.result) {
                dependencyResult.response.results = serviceRequest.response.result;
            }
            if (serviceRequest.response.results) {
                dependencyResult.response.results = serviceRequest.response.results;
            }
        }

        return dependencyResult;
    });

    return dependencies;
}

/**
 * Module Exports
 */
export {
    generateFullYardContext,
    filterContext,
    generateMicroserviceDependencies,
};
