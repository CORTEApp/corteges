# Changelog

## 2026-06-08
- Recalculated billing document base, IVA and total from billing lines during SharePoint import and added an idempotent migration for existing documents.
- Added a delegated Microsoft SharePoint file-consent flow for recovering expense PDFs from original list-item attachments.
- Added a guarded SharePoint attachment recovery tool for remaining individual expense PDFs tied to the original SharePoint list item.
- Added a PDF text inspection fallback to mail recovery so attachments can match historical expenses even when the invoice number is absent from the email subject or filename.
- Rotated mail recovery candidate selection by default so automatic cron runs do not get stuck on the same resistant missing-PDF expenses.
- Expanded mail PDF recovery to support all-mailbox searches by default instead of only `inbox`.
- Hardened recovered expense PDF storage keys by normalizing mail attachment names to ASCII-safe filenames and redacting storage paths from recovery errors.
- Added a protected cron endpoint and Coolify runner for automatic gradual recovery of missing individual expense PDFs from Microsoft mail.
- Added a guarded mail-based recovery tool for historical individual expenses whose legacy attachment flag exists but no PDF document row was imported.
- Added `/api/health` as a lightweight no-secret health endpoint for Coolify/Codex Control deployment verification, bypassing the Supabase auth proxy.
- Hardened expense invoice attachment intake with PDF signature validation, a 20 MB per-file limit, normalized PDF MIME storage, oversized Microsoft attachment skipping, and `nosniff` PDF delivery.

## 2026-06-07
- Handled revoked Supabase SSR refresh-token cookies in `proxy.ts` to avoid production `refresh_token_not_found` runtime logs.
- Adjusted Microsoft Graph inbox PDF import query to satisfy message `$filter`/`$orderby` constraints and added a defensive fallback.

## 2026-05-26
- Prepared Coolify deployment for `ges.corteapp.es`.
- Added a guarded monthly invoices cron runner for Coolify scheduled tasks.
- Updated Next/React baseline and dependency overrides for audit hardening.

## v7 — UI fusion pack
- integración del UI system V1 dentro del scaffold de `project_init`
- shell inicial separada en marketing + app surface
- catálogo interno de bloques y reglas visuales dentro de `packages/`
- auditoría estática reproducible con `tools/ui_system_audit.py`
- actualización de prompts/skills para componer UI desde bloques internos

<!-- codex-control:generated-context:v1 -->

## 2026-06-06 - Normalizacion Codex Control

- Regenerado contrato documental de Codex Control.
- Actualizados AGENTS.md, contexto, paginas, playbooks, auditorias y manifest.
- La documentacion previa queda preservada en este archivo y respaldada en `.codex-control/backups/`.
