 


CREATE TABLE IF NOT EXISTS public.services (
    id BIGSERIAL PRIMARY KEY,
    name character varying,
    service_type character varying,
    service_url  character varying,
    health_endpoint  character varying,
    licence_key  character varying,
    config       jsonb,
    class        character varying,
    is_dummy  boolean DEFAULT false,
    unhealthy boolean DEFAULT false,
    enabled boolean DEFAULT false,
    created_at timestamp(6) without time zone NOT NULL DEFAULT NOW(),
    deleted_at timestamp(6) without time zone,
    modified_at timestamp(6) without time zone NOT NULL DEFAULT NOW(),
    availability_timeout integer DEFAULT 180,
    result_timeout integer DEFAULT 180,
    require_agents_data boolean DEFAULT true,
    require_mission_agents_data boolean DEFAULT true,
    require_map_data boolean DEFAULT true,
    require_map_objects text[] DEFAULT ARRAY['__all__'],
    description character varying
    );


CREATE UNIQUE INDEX only_one_type_enabled ON public.services (service_type, service_type) WHERE enabled IS true;

comment on column services.name is '@ name of service';
comment on column services.result_timeout is '@ maximum time helyOS will wait for the result in seconds';
comment on column services.service_type is '@ type of service. Examples: "drive", "field_cover", "storage", "map"';
comment on column services.service_url is '@ url of the web service';
comment on column services.licence_key is '@ licence key (to be provided for web service as x-api-key header)';
comment on column services.config is '@ additional information to be provided for web service. For instance, for trucktrix path planner the following parameters could be provided (default first): "trucktrix_planner_type": "all_directions"/"forward"; "postprocessing": "no_postprocessing"/"smoothing"/"high_resolution_at_end". ';
comment on column services.class is '@ class of web service. Supported: "Path Planner", "Storage", "Map Service"';
comment on column services.is_dummy is '@ do not dispatch request; just copy request body to response body';
comment on column services.health_endpoint is '@ end-point that returns status 2XX when service is healthy';
comment on column services.unhealthy is '@  Is microservice unhealthy?';
comment on column services.availability_timeout is '@ maximum time helyos will hold a request waiting for the system to be healthy';
comment on column services.filter_map_objects is '@ array used to filter map objects by type to be included in the helyOS context, sent to the microservice.';
comment on column services.description is '@ description of service';