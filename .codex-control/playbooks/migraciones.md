# Playbook: migraciones

## Procedimiento

1. Leer esquema actual y migraciones recientes.
2. Preparar migracion pequena y reversible cuando sea posible.
3. No mezclar refactor de codigo con migracion de datos si no hace falta.
4. Validar impacto en RLS, indices, funciones y triggers.
5. Documentar la migracion en CHANGELOG.md.
