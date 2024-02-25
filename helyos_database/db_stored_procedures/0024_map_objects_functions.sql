 


CREATE OR REPLACE FUNCTION public.recentmap_objects(
	test_time double precision)
    RETURNS SETOF public.map_objects 
    LANGUAGE 'sql'

    COST 100
    STABLE 
    ROWS 1000
AS $BODY$

 SELECT *  FROM public.map_objects WHERE created_at > to_timestamp(test_time) OR
                modified_at > to_timestamp(test_time) OR 
                deleted_at > to_timestamp(test_time);
 
$BODY$;


CREATE OR REPLACE FUNCTION public.mark_deleted_all_map_objects_of_yard(
	yard_id_input bigint)
    RETURNS SETOF public.map_objects 
    LANGUAGE 'sql'

    COST 100
    VOLATILE  
    ROWS 1000
AS $BODY$

 UPDATE public.map_objects  SET  deleted_at =  now()  WHERE yard_id = yard_id_input AND deleted_at IS NULL RETURNING *;
 
$BODY$;




--
--  Function used by the Triggers:  notifications on updates and automatic procedures
--




--
-- Notifications
--

