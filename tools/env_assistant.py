#!/usr/bin/env python3
"""Interactive helper to create a Supabase-focused .env.local file and a masked report."""
from __future__ import annotations

import argparse
import os
from getpass import getpass
from pathlib import Path
from urllib.parse import urlparse
import sys


def prompt_value(label: str, current: str | None = None, secret: bool = False, allow_empty: bool = False) -> str:
    suffix = f" [{current}]" if current else ""
    while True:
        if not sys.stdin.isatty():
            if current:
                return current
            if allow_empty:
                return ""
            raise EOFError(f"Cannot prompt for {label!r} in non-interactive mode. Provide it as a flag.")
        value = getpass(f"{label}{suffix}: ") if secret else input(f"{label}{suffix}: ")
        value = value.strip()
        if not value and current:
            return current
        if not value and allow_empty:
            return ""
        if value:
            return value
        print("Value required.")


def is_valid_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def mask(value: str) -> str:
    if not value:
        return "(empty)"
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:2]}***{value[-4:]}"


def write_env_file(path: Path, data: dict[str, str], force: bool) -> None:
    if path.exists() and not force:
        raise FileExistsError(f"{path} already exists. Use --force to overwrite.")
    order = [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_ACCESS_TOKEN",
    ]
    lines = [f"{key}={data.get(key, '')}" for key in order if data.get(key, "")]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_report(path: Path, env_file: Path, environment: str, data: dict[str, str], warnings: list[str]) -> None:
    rows = []
    for key in [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_ACCESS_TOKEN",
    ]:
        value = data.get(key, "")
        state = "present" if value else "missing"
        observed = value if key == "NEXT_PUBLIC_SUPABASE_URL" else mask(value)
        rows.append(f"| `{key}` | {state} | assisted | {observed} |")
    warning_block = "\n".join(f"- {item}" for item in warnings) if warnings else "- none"
    content = f"""# Env Setup Report

## Archivo objetivo
- `{env_file}`

## Entorno declarado
- {environment}

## Variables recogidas
| Variable | Estado | Fuente | Observación |
|---|---|---|---|
{os.linesep.join(rows)}

## Validación
- formato básico URL: {'ok' if is_valid_url(data.get('NEXT_PUBLIC_SUPABASE_URL', '')) else 'invalid'}
- claves mínimas presentes: {'ok' if data.get('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') and (data.get('SUPABASE_SECRET_KEY') or data.get('SUPABASE_SERVICE_ROLE_KEY')) else 'missing'}
- secretos solo en servidor: revisar consumo del repo

## Pasos manuales pendientes
{warning_block}
"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Assist Supabase env setup for CORTE.Ges repos.")
    parser.add_argument("--out", default=".env.local")
    parser.add_argument("--report", default=".ai/ENV_SETUP_REPORT.md")
    parser.add_argument("--environment", choices=["local", "staging", "production"])
    parser.add_argument("--url", default="")
    parser.add_argument("--publishable-key", default="")
    parser.add_argument("--secret-key", default="")
    parser.add_argument("--service-role-key", default="")
    parser.add_argument("--access-token", default="")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    environment = args.environment or prompt_value("Environment (local/staging/production)", current="local")
    if environment not in {"local", "staging", "production"}:
        raise SystemExit("Environment must be local, staging, or production.")

    url = args.url or prompt_value("NEXT_PUBLIC_SUPABASE_URL")
    while not is_valid_url(url):
        print("Please enter a valid http(s) URL.")
        url = prompt_value("NEXT_PUBLIC_SUPABASE_URL")

    publishable_key = args.publishable_key or prompt_value("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    secret_key = args.secret_key or prompt_value("SUPABASE_SECRET_KEY (preferred)", secret=True, allow_empty=True)
    service_role_key = args.service_role_key or prompt_value("SUPABASE_SERVICE_ROLE_KEY (legacy fallback, optional)", secret=True, allow_empty=True)
    access_token = args.access_token or prompt_value("SUPABASE_ACCESS_TOKEN (optional)", secret=True, allow_empty=True)

    data = {
        "NEXT_PUBLIC_SUPABASE_URL": url,
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": publishable_key,
        "SUPABASE_SECRET_KEY": secret_key,
        "SUPABASE_SERVICE_ROLE_KEY": service_role_key,
        "SUPABASE_ACCESS_TOKEN": access_token,
    }
    warnings = []
    if not secret_key and not service_role_key:
        warnings.append("Missing server-side key. Privileged operations remain blocked.")
    if not access_token:
        warnings.append("SUPABASE_ACCESS_TOKEN omitted. Fine unless you automate management tasks.")

    env_path = Path(args.out)
    env_path.parent.mkdir(parents=True, exist_ok=True)
    write_env_file(env_path, data, args.force)
    report_path = Path(args.report)
    write_report(report_path, env_path, environment, data, warnings)

    print(f"Wrote {env_path}")
    print(f"Wrote {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
