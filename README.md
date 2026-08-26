# Gabino Agrogestión API

Backend **NestJS + TypeORM + PostgreSQL**, autenticación con **Firebase Auth**.

## Comandos

```bash
pnpm install          # instalar dependencias
pnpm run start:dev    # desarrollo (watch) → http://localhost:3063/api
pnpm build            # nest build (tsc)
pnpm run lint         # eslint + prettier (--fix)
pnpm test             # jest
```

## Variables de entorno (`.env`)

- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` — conexión PostgreSQL.
- `PORT` — puerto (default `3063`).
- `CACHE_AUTH_TTL`, `CACHE_USUARIOS_TTL` — TTL del cache de Firestore en milisegundos (default 4h).
- `DO_SPACES_ENDPOINT`, `DO_SPACES_REGION`, `DO_SPACES_KEY`, `DO_SPACES_SECRET`,
  `DO_SPACES_BUCKET`, `DO_SPACES_PUBLIC_URL` — DigitalOcean Spaces para guardar los PDFs
  de prescripciones que se comparten por WhatsApp (endpoint, región, credenciales, bucket y
  URL pública base; `DO_SPACES_REGION` y `DO_SPACES_PUBLIC_URL` son opcionales).
- `firebase-service-account.json` — credenciales del service account en la raíz del proyecto.

## Base de datos y migraciones

`TypeORM` corre con `synchronize: false`: los cambios de esquema se aplican con
archivos SQL manuales en `migrations/` (numerados, ej. `022-campania-drop-nombre.sql`).
Cada migración nueva debe ejecutarse a mano contra la BD (psql u otro cliente).
Las entidades nuevas también deben registrarse en `src/app.module.ts`.

## Autenticación y Firestore

- `FirebaseStrategy` (`src/auth/strategies/firebase.strategy.ts`) valida el ID token por request y
  resuelve `idEmpresas`, `roles` y `permisos` desde Firestore (`usuarios`, `roles`, `permisos`).
- **`FirestoreCacheService`** (`src/cache/firestore-cache.service.ts`) cachea en memoria:
  - auth por UID (`getOrLoadAuth`) — siempre incluye permisos reales;
  - el listado de usuarios (`getOrLoadUsuarios`).
- `POST /cache/invalidate` limpia todos los caches (lo llama el botón de Configuración y el
  signup vía `POST /usuarios/bootstrap`).
- Los mutadores de asociación (`PATCH /usuarios/:uid/empresas`, `POST /empresas`) invalidan el cache.

## Convenciones

- Nombres de columnas en snake_case (`id_empresa`), entidades en camelCase.
- Errores vía `BadRequestException`/`ForbiddenException`/`NotFoundException` (el FE muestra `message`).
- Permisos con `@Permissions('lectura:...')` / `@Permissions('escritura:...')`.
