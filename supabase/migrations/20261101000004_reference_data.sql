-- Planes iniciales de la plataforma (editables por el superadmin).
insert into public.plans (id, name, price_monthly, currency, max_customers, max_staff, max_programs, features) values
  ('plan_starter',  'Starter',  59000,  'COP', 300,  2,    1,  array['1 programa', 'Tarjeta web con QR', 'Hasta 300 clientes', '2 empleados']),
  ('plan_pro',      'Pro',      119000, 'COP', 2000, 10,   3,  array['3 programas', 'Marca blanca completa', 'Hasta 2.000 clientes', 'Estadísticas avanzadas']),
  ('plan_business', 'Business', 249000, 'COP', null, null, 10, array['Programas ilimitados', 'Clientes ilimitados', 'Multi-sede (próx.)', 'Soporte prioritario'])
on conflict (id) do nothing;
