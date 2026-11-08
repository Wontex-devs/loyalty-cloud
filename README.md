# Wontex: fidelización digital de marca blanca

Plataforma SaaS multiempresa de tarjetas de fidelización web.

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npm run dev        # http://localhost:3000
npm run typecheck
npm run test:db    # migraciones + 63 pruebas de RLS y reglas de negocio (Postgres en memoria)
npm run db:verify  # comprobaciones contra el proyecto Supabase real (--e2e: flujo inscripción + visita)
npm run db:seed    # carga Beauty Club en tu proyecto Supabase
```

- Arquitectura, modelo de datos, seguridad y recorrido de la demo: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
- Conectar Supabase (Etapa 2): [docs/ETAPA-2-SUPABASE.md](docs/ETAPA-2-SUPABASE.md)
- Inscripción, QR y visitas (Etapa 3): [docs/ETAPA-3.md](docs/ETAPA-3.md)
- Recompensas, canjes, historial y estadísticas (Etapa 4): [docs/ETAPA-4.md](docs/ETAPA-4.md)
- Google Wallet (Etapa 9): [docs/ETAPA-9-WALLET.md](docs/ETAPA-9-WALLET.md)
- Pruebas, despliegue y plan del piloto (Etapa 5): [docs/ETAPA-5.md](docs/ETAPA-5.md) · Guía para el equipo: [docs/GUIA-EQUIPO.md](docs/GUIA-EQUIPO.md)
- Comercio de ejemplo: **Beauty Club** (`/business/beautyclub`, `/join/beautyclub`)
