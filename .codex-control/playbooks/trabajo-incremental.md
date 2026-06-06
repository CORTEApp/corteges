# Playbook: trabajo incremental

## Objetivo

Modificar lo existente sin regenerar desde cero.

## Procedimiento

1. Localiza archivos afectados.
2. Lee patrones vecinos.
3. Haz el cambio minimo.
4. Ejecuta solo la auditoria seleccionada por el usuario.
5. Documenta decisiones relevantes en CHANGELOG.md.

## Prohibido

- Sustituir una pantalla completa si basta con ajustar componentes.
- Rehacer arquitectura por preferencia estetica.
- Crear rutas paralelas para evitar entender la existente.
