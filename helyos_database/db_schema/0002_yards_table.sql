CREATE TABLE IF NOT EXISTS public.yards (
  id BIGSERIAL PRIMARY KEY,
  uid CHARACTER VARYING,
  name CHARACTER VARYING,
  source CHARACTER VARYING,
  yard_type CHARACTER VARYING,
  map_data JSONB,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  originshift_dx INTEGER,
  originshift_dy INTEGER,
  picture_base64 TEXT,
  picture_pos JSONB,
  created_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP(6) WITHOUT TIME ZONE,
  modified_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  description CHARACTER VARYING,
  rbmq_vhost CHARACTER VARYING(255) DEFAULT NULL,
  alt DOUBLE PRECISION,
  data_format CHARACTER VARYING DEFAULT 'trucktrix-map',
  unit CHARACTER VARYING DEFAULT 'mm - mrad',
  coordinate_frame CHARACTER VARYING DEFAULT 'local-UTM',
  UNIQUE (uid)
);

COMMENT ON COLUMN yards.yard_type IS '@ type of the yard. Currently supported: "logistic_yard"';
COMMENT ON COLUMN yards.map_data IS '@ map data object. Example: { "origin": { "lat": 51.0531973, "lon": 13.7031056, "zoomLevel": 19 }}';
COMMENT ON COLUMN yards.lat IS '@ latitude of the yard reference point';
COMMENT ON COLUMN yards.lon IS '@ longitude of the yard reference point';
COMMENT ON COLUMN yards.description IS '@ field for the arbitrary description of the yard';
COMMENT ON COLUMN yards.rbmq_vhost IS '@ RabbitMQ virtual host associated with the yard.';
COMMENT ON COLUMN yards.coordinate_frame IS '@ Coordinate frame used for the yard.';
COMMENT ON COLUMN yards.unit IS '@ Unit of measurement for the yard.';