CREATE TABLE IF NOT EXISTS public.services (
  id BIGSERIAL PRIMARY KEY,
  name CHARACTER VARYING,
  service_type CHARACTER VARYING,
  service_url CHARACTER VARYING,
  health_endpoint CHARACTER VARYING,
  licence_key CHARACTER VARYING,
  config JSONB,
  class CHARACTER VARYING,
  is_dummy BOOLEAN DEFAULT FALSE,
  unhealthy BOOLEAN DEFAULT FALSE,
  enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP(6) WITHOUT TIME ZONE,
  modified_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  availability_timeout INTEGER DEFAULT 180,
  result_timeout INTEGER DEFAULT 180,
  require_agents_data BOOLEAN DEFAULT TRUE,
  require_mission_agents_data BOOLEAN DEFAULT TRUE,
  require_map_data BOOLEAN DEFAULT TRUE,
  require_map_objects TEXT[] DEFAULT ARRAY['__all__'],
  description CHARACTER VARYING DEFAULT ''
);

CREATE UNIQUE INDEX only_one_type_enabled ON public.services (service_type, service_type) WHERE enabled IS TRUE;

COMMENT ON COLUMN services.name IS '@ name of service';
COMMENT ON COLUMN services.result_timeout IS '@ maximum time helyOS will wait for the result in seconds';
COMMENT ON COLUMN services.service_type IS '@ type of service. Examples: "drive", "field_cover", "storage", "map"';
COMMENT ON COLUMN services.service_url IS '@ url of the web service';
COMMENT ON COLUMN services.licence_key IS '@ licence key (to be provided for web service as x-api-key header)';
COMMENT ON COLUMN services.config IS '@ additional information to be provided for web service. For instance, for trucktrix path planner the following parameters could be provided (default first): "trucktrix_planner_type": "all_directions"/"forward"; "postprocessing": "no_postprocessing"/"smoothing"/"high_resolution_at_end".';
COMMENT ON COLUMN services.class IS '@ class of web service. Supported: "Path Planner", "Storage", "Map Service"';
COMMENT ON COLUMN services.is_dummy IS '@ do not dispatch request; just copy request body to response body';
COMMENT ON COLUMN services.health_endpoint IS '@ end-point that returns status 2XX when service is healthy';
COMMENT ON COLUMN services.unhealthy IS '@ Is microservice unhealthy?';
COMMENT ON COLUMN services.availability_timeout IS '@ maximum time helyos will hold a request waiting for the system to be healthy';
COMMENT ON COLUMN services.require_map_objects IS '@ array used to filter map objects by type to be included in the helyOS context, sent to the microservice.';
COMMENT ON COLUMN services.description IS '@ description of service';