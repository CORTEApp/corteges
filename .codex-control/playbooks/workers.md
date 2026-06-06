# Playbook: workers y tareas

## Como actuar

- Identificar cola, cron o proceso antes de cambiar codigo.
- Evitar duplicar workers o crear bucles sin lock/idempotencia.
- Registrar eventos suficientes para diagnostico.
- Probar reintentos, timeouts y fallos parciales.
