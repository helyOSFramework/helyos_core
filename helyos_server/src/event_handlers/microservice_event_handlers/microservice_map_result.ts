// Services imports
import * as DatabaseService from '../../services/database/database_services';
import * as utils from '../../modules/utils';
import { logData } from '../../modules/systemlog';

// ----------------------------------------------------------------------------
// Work Process => Work Process Type Definitions => Service Request(s) => Map Update(s)
// ----------------------------------------------------------------------------

// Type Definitions
interface MapObject {
    data_format: string;
    type: string;
    metadata: any;
    data: any;
    name: string;
}

interface MapOrigin {
    lat: number;
    lon?: number;
    long?: number;
    alt?: number;
}

interface YardData {
    map_objects?: MapObject[];
    mapObjects?: MapObject[];
    origin?: MapOrigin;
    map_data?: any;
    mapData?: any;
}

/**
 * Inserts multiple map objects asynchronously.
 * @param yardId The ID of the yard.
 * @param mapObjects An array of map objects to insert.
 * @returns A promise that resolves when all map objects are inserted.
 */
const insertManyMapObjectsAsync = async (yardId: number, mapObjects: MapObject[]): Promise<void[]> => {
    const databaseServices = await DatabaseService.getInstance();
    const responsePromises = mapObjects.map((mapObj) => {
        // Filter only valid properties
        const { data_format, type, metadata, data, name } = mapObj;
        const _mapObj = { data_format, type, metadata, data, name };
        return databaseServices.map_objects.insert({ ..._mapObj, yard_id: yardId });
    });

    return Promise.all(responsePromises);
};

/**
 * Updates map data for a yard by deleting existing objects and inserting new ones.
 * @param yardId The ID of the yard to update.
 * @param yardData The new map data for the yard.
 * @returns A promise that resolves when all updates are complete.
 */
async function updateMap(yardId: number, yardData: YardData): Promise<any> {
    const databaseServices = await DatabaseService.getInstance();
    let mapObjects = yardData.map_objects || yardData.mapObjects || [];
    mapObjects = mapObjects.map((mapObj) => utils.snakeCaseAttributes(mapObj) as MapObject);

    const mapOrigin = yardData.origin || null;
    const mapData = yardData.map_data || yardData.mapData || null;

    const responsePromises: Promise<any>[] = [];

    if (mapObjects.length > 0) {
        responsePromises.push(
            databaseServices.map_objects.update('yard_id', yardId, { deleted_at: new Date() })
                .then(() => insertManyMapObjectsAsync(yardId, mapObjects))
                .catch((e) =>
                    logData.addLog(
                        'microservice',
                        { yardId },
                        'error',
                        `updating map objects: ${JSON.stringify(e)}`
                    )
                )
        );
    }

    if (mapOrigin) {
        responsePromises.push(
            databaseServices.yards
                .update_byId(yardId, {
                    lat: mapOrigin.lat,
                    lon: mapOrigin.lon || mapOrigin.long,
                    alt: mapOrigin.alt,
                    source: 'microservice',
                })
                .catch((e) =>
                    logData.addLog(
                        'microservice',
                        { yardId },
                        'error',
                        `updating map origin: ${JSON.stringify(e)}`
                    )
                )
        );
    }

    if (mapData) {
        responsePromises.push(
            databaseServices.yards
                .update_byId(yardId, { map_data: mapData, source: 'microservice' })
                .catch((e) =>
                    logData.addLog(
                        'microservice',
                        { yardId },
                        'error',
                        `updating map_data: ${JSON.stringify(e)}`
                    )
                )
        );
    }

    return Promise.all(responsePromises);
}

/**
 * Placeholder function for creating a yard.
 * @param yardData The data for the yard to create.
 */
async function mapCreate(yardData: YardData): Promise <void> {
    console.log('Yard creation by microservices is not implemented...');
}



export { updateMap, mapCreate };