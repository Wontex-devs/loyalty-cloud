# Lazo: fidelización digital de marca blanca

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
- Visita por toque NFC con etiqueta en el mostrador (Etapa 13): [docs/ETAPA-13-NFC.md](docs/ETAPA-13-NFC.md)
- Pruebas, despliegue y plan del piloto (Etapa 5): [docs/ETAPA-5.md](docs/ETAPA-5.md) · Guía para el equipo: [docs/GUIA-EQUIPO.md](docs/GUIA-EQUIPO.md)
- Comercio de ejemplo: **Beauty Club** (`/business/beautyclub`, `/join/beautyclub`)

## Cómo colaborar desde GitHub

Cada cambio que llega a `main` se publica solo en https://app.wontex-devs.com (GitHub Actions, `.github/workflows/deploy.yml`).

1. Crea una rama, haz tus cambios y abre un **pull request** hacia `main`.
2. GitHub revisa el código (tipos y pruebas). Mientras la revisión no pase en verde, no se debe unir.
3. Cuando la revisión pasa, tú mismo unes el pull request a `main` (no hace falta aprobación de nadie) y el cambio queda en producción en uno o dos minutos.

No subas secretos ni archivos `.env`: las claves viven en Vercel.
