CREATE TABLE IF NOT EXISTS map_objects (
  id BIGSERIAL PRIMARY KEY,
  yard_id BIGINT REFERENCES yards(id) ON DELETE CASCADE,
  data JSONB,
  type CHARACTER VARYING,
  data_format CHARACTER VARYING DEFAULT 'trucktrix-map',
  metadata JSONB,
  created_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  modified_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP(6) WITHOUT TIME ZONE,
  name CHARACTER VARYING DEFAULT NULL,
  last_message_time TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
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

COMMENT ON COLUMN map_objects.type IS '@description map_object type: "crop", "road", "drivable", "guide-line", "obstacle"';
COMMENT ON COLUMN map_objects.name IS '@description map_object name: "strawbery field - 02", "Load Gate A", etc.';
COMMENT ON COLUMN map_objects.data IS '@description Add any information relevant this map_object; e.g. geometry';
COMMENT ON COLUMN map_objects.data_format IS '@description Define the format of the data field. The default is trucktrix-map';
COMMENT ON COLUMN map_objects.metadata IS '@description Provide additional information carried by the field data';