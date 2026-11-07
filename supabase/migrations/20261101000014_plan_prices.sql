-- Precios y límites comerciales. Business se ajusta a cada negocio: su precio aquí es solo una referencia.
update public.plans set price_monthly = 59900, max_customers = 100,
  features = array['1 programa', 'Hasta 100 clientes', '2 empleados', '1 sede']
where id = 'plan_starter';
update public.plans set price_monthly = 119900, max_customers = 300,
  features = array['3 programas', 'Hasta 300 clientes', '10 empleados', 'Hasta 3 sedes']
where id = 'plan_pro';
update public.plans set features = array['Plan a la medida', 'Clientes, equipo y sedes según tu negocio', 'Soporte prioritario']
where id = 'plan_business';
