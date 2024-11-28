 
CREATE TABLE IF NOT EXISTS public.yards (
    id BIGSERIAL PRIMARY KEY,
    uid  character varying,
    name character varying,
    source character varying,
    yard_type character varying,
    map_data jsonb,
    lat double precision,
    lon double precision,
    originshift_dx integer,
    originshift_dy integer,
    picture_base64 text,
    picture_pos jsonb,
    created_at timestamp(6) without time zone NOT NULL DEFAULT NOW(),
    deleted_at timestamp(6) without time zone,
    modified_at timestamp(6) without time zone NOT NULL DEFAULT NOW(),
    description character varying,
    rbmq_vhost character varying(255) DEFAULT NULL,
    alt double precision,
    data_format character varying default 'trucktrix-map',
    coordinate_unit character varying default 'mm_xy_east_north'

    );



comment on column yards.yard_type is '@ type of the yard. Currently supported: "logistic_yard"';
comment on column yards.map_data is '@ map data object. Example: { "origin": { "lat": 51.0531973, "lon": 13.7031056, "zoomLevel": 19 }}';
comment on column yards.lat is '@ latitude of the yard reference point';
comment on column yards.lon is '@ longitude of the yard reference point';
comment on column yards.description is '@ field for the arbitrary description of the yard';
comment on column yards.rbmq_vhost is '@ rabbitmq virtual host'; 

