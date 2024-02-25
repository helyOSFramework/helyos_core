 
CREATE TABLE IF NOT EXISTS map_objects (
    id BIGSERIAL PRIMARY KEY,
    yard_id bigint REFERENCES yards(id) ON DELETE CASCADE,
    data jsonb,
    type character varying,
    data_format character varying default 'trucktrix-map',
    metadata jsonb,
    created_at timestamp(6) without time zone NOT NULL DEFAULT NOW(),
    modified_at timestamp(6) without time zone NOT NULL DEFAULT NOW(),
    deleted_at timestamp(6) without time zone,
    name character varying default NULL
    );



CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER set_timestamp
BEFORE UPDATE ON map_objects
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


comment on column map_objects.type is        '@description map_object type: "crop", "road", "drivable", "guide-line", "obstacle" ';
comment on column map_objects.name is        '@description map_object name: "strawbery field - 02", "Load Gate A", etc. ';
comment on column map_objects.data is        '@description Add any information relevant this map_object; e.g. geometry';
comment on column map_objects.data_format is '@description Define the format of the data field. The default is trucktrix-map';
comment on column map_objects.metadata is    '@description Provide additional information carried by the field data';


