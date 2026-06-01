# Coolify production runbook

Este runbook es la fuente de verdad operativa para conectar con Coolify y operar la app productiva `corteges`. No contiene secretos: solo ubicaciones, nombres de variables, identificadores y procedimientos.

## Identificadores

- Panel: `https://coolify.corteapp.es`
- App publica: `https://ges.corteapp.es`
- Recurso Coolify: `corteges`
- UUID aplicacion: `x6k0as1xsjbt5lclqz77casu`
- Proyecto Coolify: `7f4213180e9a0ba72d6a62224`
- Environment Coolify: `f54d9cffed21107a1f716c5d4`
- Ruta panel app: `https://coolify.corteapp.es/project/7f4213180e9a0ba72d6a62224/environment/f54d9cffed21107a1f716c5d4/application/x6k0as1xsjbt5lclqz77casu`

## Acceso y credenciales

- SSH operativo: `deploy@coolify.corteapp.es`
- Clave SSH local esperada: `~/.ssh/corteapp_deploy_ed25519`
- No copiar la clave SSH al repo ni pegar su contenido en issues, logs o docs.
- Variables locales relevantes:
  - `corteges/.env.local`
  - `.env` en la raiz del workspace
- Esas env locales contienen nombres como `user_master`, `user_master_password`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. No documentar sus valores.
- En servidor, Coolify guarda las variables cifradas en su configuracion interna. El `.env` materializado de la app vive en `/data/coolify/applications/x6k0as1xsjbt5lclqz77casu/.env`.
- La fuente de verdad de la credencial master es `user_master` / `user_master_password` en env. Supabase Auth debe resincronizarse con `npm run auth:master`; no cambiar la password master a mano y asumir que queda persistida como canon.

## Regla critica de env vars

- No insertar ni actualizar `environment_variables.value` directamente en PostgreSQL.
- Coolify espera que `environment_variables.value` este cifrado por Laravel. Un valor en claro rompe la pantalla de configuracion de esa app con `The payload is invalid`.
- Para cambiar env vars, usar preferentemente el panel de Coolify. Si no es posible y hay que operar por servidor, usar el modelo/runtime de Coolify o su API, nunca SQL crudo sobre `value`.
- Si se toca el `.env` materializado a mano para una emergencia, persistir despues el cambio en la configuracion cifrada de Coolify y recrear/desplegar la app.

## Deploy y verificacion

- El push a `main` en `CORTEApp/corteges` dispara despliegue Coolify.
- La app Coolify debe conservar el post-deployment command `npm run auth:master` y `post_deployment_command_container` vacio. Este paso reescribe en Supabase Auth la credencial master declarada en env y evita drift entre despliegues.
- Verificar cola de despliegue en servidor con una consulta de solo lectura a `application_deployment_queues`.
- Verificar contenedor activo con Docker: debe existir un contenedor cuyo nombre empiece por `x6k0as1xsjbt5lclqz77casu-`, imagen `x6k0as1xsjbt5lclqz77casu:<commit>` y estado `healthy`.
- No dar el deploy por bueno hasta que el commit activo del contenedor coincida con `origin/main`.

Comandos seguros de inspeccion:

```bash
ssh -i ~/.ssh/corteapp_deploy_ed25519 deploy@coolify.corteapp.es
sudo docker ps --filter name=x6k0as1xsjbt5lclqz77casu --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
sudo docker exec coolify-db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off -c "select id, deployment_uuid, status, commit, created_at, finished_at from application_deployment_queues where application_id = 2::text order by created_at desc limit 5;"'
sudo docker exec coolify-db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off -c "select post_deployment_command, post_deployment_command_container from applications where id = 2;"'
```

## Smoke minimo

- `https://ges.corteapp.es/auth/login` responde `200`.
- Login real con `user_master` / `user_master_password` responde `200` contra Supabase Auth. Comprobar sin imprimir email, password, tokens ni refresh tokens.
- Assets de marca responden `200`:
  - `https://ges.corteapp.es/brand/corteges/logo-full.svg`
  - `https://ges.corteapp.es/brand/corteges/watermark.png`
- El contenedor productivo esta `healthy`.
- Las variables runtime esperadas existen dentro del contenedor cuando aplique, por ejemplo `user_master` y `user_master_password`, siempre comprobadas sin imprimir valores.
- La ruta de Coolify de la app no devuelve `500`; sin sesion debe redirigir a login.

## Incidentes conocidos

- Si Coolify muestra `The payload is invalid` al abrir la app `corteges`, revisar filas corruptas/no cifradas en `environment_variables` antes de desplegar.
- Si el login master devuelve `invalid_credentials` pero las env locales y de Coolify coinciden, hay drift en Supabase Auth: ejecutar `npm run auth:master` desde el repo o desde el contenedor activo, verificar login y confirmar que Coolify conserva el post-deploy `npm run auth:master`.
- Si Nixpacks falla instalando `libasound2`, usar `libasound2t64` en `nixpacks.toml`.
- Para PDFs con Playwright en Coolify, `PLAYWRIGHT_BROWSERS_PATH` debe mantenerse en `0` y los assets deben resolverse por URL publica o ruta servida por la app.
