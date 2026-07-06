# Historial de versiones

Este changelog agrupa los commits actuales en releases funcionales para que el proyecto tenga una narrativa clara de versionamiento.

## En desarrollo

### Agregado

- Login 2FA con recovery codes: `POST /authentication/2fa/verify-login` acepta `code` TOTP o `recoveryCode`.
- Consumo de recovery codes de un solo uso mediante `usedAt`.
- Normalizacion de recovery codes para aceptar codigos con o sin guion.

## v0.6.0 - Base de autenticacion completa

### Agregado

- Registro publico de usuarios.
- Verificacion de correo electronico.
- Flujo de login con 2FA mediante challenge.
- Middleware de request id para trazabilidad basica.
- Pruebas e2e para login, 2FA y verificacion de correo.
- Pipeline base de CI para build, Prisma y pruebas.
- Tags Swagger por controlador.

### Cambiado

- La ruta publica del modulo queda estandarizada bajo `/authentication`.
- Los servicios internos abreviados como `AuthCookiesService` y `AuthTokensService` se renombran a `AuthenticationCookiesService` y `AuthenticationTokensService`.
- El guard JWT propio queda como `JwtAuthenticationGuard`.
- El servicio de autenticacion por socket queda como `NotificationsSocketAuthenticationService`.
- El refresh token valida sesion activa, expiracion absoluta, expiracion por inactividad y reutilizacion de token.
- Logout global revoca sesiones activas, no solo refresh tokens.
- Rate limit configurable por endpoint sensible.

## v0.5.0 - Endurecimiento operativo y documentacion base

### Agregado

- Configuracion inicial de Swagger.
- Modulo de health check.
- Modulo base de integraciones HTTP.
- Modulo scheduler.
- Estructura de errores estandarizados.
- Helpers para soft delete en Prisma.
- Migracion inicial formal en `prisma/migrations`.
- Documento de estandar del proyecto.

### Cambiado

- Filtros de excepciones alineados a una respuesta de error uniforme.
- Repositorios ajustados para respetar registros activos y soft delete.
- README actualizado con contexto de uso del backend base.

## v0.4.0 - Respuestas limpias por modulo

### Agregado

- Response entities para usuarios, accesos, roles, permisos, documentos, notificaciones, perfil y sesiones.
- Serializacion explicita de respuestas para evitar exponer datos innecesarios.

### Cambiado

- Servicios y use cases devuelven respuestas mas simples, directas y consistentes.
- Los endpoints reducen datos anidados y propiedades no necesarias.

## v0.3.0 - Modulos funcionales y seguridad de cuenta

### Agregado

- Modulo de usuarios con creacion, actualizacion, baja logica, accesos y permisos efectivos.
- Modulo de roles y permisos.
- Modulo de documentos con carga, consulta, descarga y actualizacion.
- Modulo de notificaciones con WebSocket.
- 2FA con TOTP, recuperacion y administracion de estado.
- Cambio de contrasena administrativa.
- Actualizacion de perfil propio.
- Revocacion de sesiones.

### Cambiado

- Repositorios optimizados con selects mas precisos.
- Servicios de documentos, notificaciones y accesos reducen consultas y datos redundantes.

## v0.2.0 - Autenticacion JWT y arquitectura modular

### Agregado

- Modulo de autenticacion con login, refresh, logout, sesiones, cambio de contrasena y reset password.
- Guards globales para JWT, permisos y cambio obligatorio de contrasena.
- Decoradores de usuario actual, permisos, rutas publicas, refresh token y contexto de sesion.
- Servicios de cookies, tokens JWT y extraccion de tokens.
- Modulo global de configuracion con validacion de variables de entorno.
- Modulos base para usuarios, organizaciones, sesiones, documentos, notificaciones y settings.
- Servicios de Crypto y Mailer.
- Rate limiter de correos.
- Utilidades de paginacion, password generation, tenancy y normalizacion de email.

### Cambiado

- Se centralizan defaults de configuracion.
- Se reorganizan Crypto y Mailer fuera de `utilities` para usarlos como modulos propios.
- Se mejora el manejo de errores HTTP, Prisma y validacion.

## v0.1.0 - Base Prisma y seed esencial

### Agregado

- Configuracion inicial de Prisma.
- Schema base con usuarios, roles, permisos, organizaciones, sesiones, tokens, 2FA, documentos, notificaciones, settings y auditoria de correos.
- Catalogo de permisos inicial.
- Seed esencial para permisos, rol administrador y usuario administrador.
- Indices unicos parciales para registros con soft delete.
- `.env.example` con variables base.

### Cambiado

- Seed simplificado para eliminar datos demo innecesarios.
- TypeScript build excluye artefactos de Prisma cuando corresponde.

## v0.0.1 - Bootstrap del proyecto

### Agregado

- Proyecto NestJS inicial.
- Configuracion base de ESLint, Prettier, TypeScript y scripts de desarrollo.
