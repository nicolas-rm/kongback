# Backend Standard

## Capas

- `Controller`: expone rutas, permisos y decoradores HTTP.
- `Dto`: valida entradas del cliente.
- `Service` o `UseCase`: ejecuta reglas de aplicación y transforma salidas públicas.
- `Repository`: consulta o persiste datos. No decide contratos de respuesta.
- `Response`: define el contrato público que sale por API.

## Respuestas

- Detalle, create y update devuelven un objeto directo construido con `Response.from(...)`.
- Listados paginados devuelven `{ data, meta }`.
- Acciones devuelven respuestas simples: `{ deleted: true }`, `{ passwordChanged: true }`, `{ revokedSessions: 1 }`.
- Conteos devuelven `{ count }`.
- No se devuelven entidades Prisma directamente desde controllers.
- Los repositories usan `select` como protección de consulta, no como contrato público.

## Errores

Los errores HTTP deben mantener este formato:

```json
{
    "statusCode": 400,
    "code": "VALIDATION_ERROR",
    "message": "Datos no validos",
    "path": "/api/users",
    "timestamp": "2026-05-12T00:00:00.000Z"
}
```

Usa `src/errors/error-codes.ts` para nuevos códigos.

## Soft Delete

- Las consultas públicas deben filtrar registros activos con `deletedAt: null`.
- Usa `activeRecordWhere(...)` cuando aplique.
- Usa `softDeleteData(...)` cuando el modelo tenga `deletedByUserId`.
- Los deletes públicos deben responder confirmaciones simples.

## Módulos Preparados

- `health`: healthcheck de app y base de datos.
- `integrations`: cliente HTTP base para integraciones externas.
- `scheduler`: punto de entrada para jobs/cron futuros.
