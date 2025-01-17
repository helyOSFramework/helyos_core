import databaseService from '../../services/database/database_services';

// Services imports

// ----------------------------------------------------------------------------
// Work Process => Work Process Type Definitions => Service Request(s) => Storage update(s)
// ----------------------------------------------------------------------------

interface MapObject {
	id: string;
	// Add other properties of the map object here
}

function updateMap(mapObject: MapObject): Promise<any> {
    return databaseService.yards.update_byId(mapObject.id, mapObject);
}

function mapCreate(mapObject: MapObject): void {
    // Add your implementation here
}

export {
    mapCreate, updateMap,
};
