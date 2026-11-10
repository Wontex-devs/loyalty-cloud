-- Nuevos precios mensuales: Starter $80.000 y Pro $140.000. Business sigue a la medida.
update public.plans set price_monthly = 80000 where id = 'plan_starter';
update public.plans set price_monthly = 140000 where id = 'plan_pro';
