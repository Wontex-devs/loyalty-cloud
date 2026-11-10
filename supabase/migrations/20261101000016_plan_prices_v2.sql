-- Nuevos precios mensuales: Starter $79.990 y Pro $139.990. Business sigue a la medida.
update public.plans set price_monthly = 79990 where id = 'plan_starter';
update public.plans set price_monthly = 139990 where id = 'plan_pro';
