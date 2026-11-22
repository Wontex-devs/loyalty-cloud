-- Nuevos límites comerciales (21-nov-2026). Los precios y el tamaño del equipo no cambian.
-- Starter: 300 clientes y 1 sede. Pro: 1.000 clientes y sedes sin límite. Business sigue a la medida.
-- Solo amplía cupos: ningún comercio queda por encima de su límite con este cambio.
update public.plans
set max_customers = 300,
    features = array['1 programa', 'Hasta 300 clientes', '2 empleados', '1 sede']
where id = 'plan_starter';

update public.plans
set max_customers = 1000,
    max_locations = null,
    features = array['3 programas', 'Hasta 1.000 clientes', '10 empleados', 'Sedes ilimitadas']
where id = 'plan_pro';
