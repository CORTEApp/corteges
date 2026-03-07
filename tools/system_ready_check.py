#!/usr/bin/env python3
"""Validate whether a CORTE.App repo has the minimum structure to be considered ready for development."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def first_existing(root: Path, candidates: Iterable[str]) -> str | None:
    for candidate in candidates:
        if (root / candidate).exists():
            return candidate
    return None


def check(root: Path, env_file: Path, expect_remote_link: bool) -> dict[str, object]:
    checks: dict[str, dict[str, str | bool]] = {}

    def add(name: str, ok: bool, detail: str) -> None:
        checks[name] = {"ok": ok, "detail": detail}

    add("agents_root", (root / "AGENTS.md").exists(), "AGENTS.md present" if (root / "AGENTS.md").exists() else "Missing AGENTS.md")
    add("orchestrator_skill", (root / ".agents/skills/corteapp-orchestrator/SKILL.md").exists(), "orchestrator skill present" if (root / ".agents/skills/corteapp-orchestrator/SKILL.md").exists() else "Missing orchestrator skill")
    add("bootstrap_skill", (root / ".agents/skills/corteapp-supabase-bootstrap/SKILL.md").exists(), "bootstrap skill present" if (root / ".agents/skills/corteapp-supabase-bootstrap/SKILL.md").exists() else "Missing bootstrap skill")

    add("package_json", (root / "package.json").exists(), "package.json present" if (root / "package.json").exists() else "Missing package.json")
    add("next_app", (root / "app/layout.tsx").exists() or (root / "app/layout.js").exists(), "app/layout present" if ((root / "app/layout.tsx").exists() or (root / "app/layout.js").exists()) else "Missing app/layout")
    add("components_json", (root / "components.json").exists(), "components.json present" if (root / "components.json").exists() else "Missing components.json (shadcn not initialized)")

    proxy_file = first_existing(root, ["proxy.ts", "proxy.js", "middleware.ts", "middleware.js"])
    add("proxy", proxy_file is not None, proxy_file or "Missing proxy.* / middleware.*")

    wiring = any((root / f"lib/supabase/client.{ext}").exists() for ext in ("ts", "js")) \
        and any((root / f"lib/supabase/server.{ext}").exists() for ext in ("ts", "js")) \
        and any((root / f"lib/supabase/admin.{ext}").exists() for ext in ("ts", "js")) \
        and any((root / f"lib/supabase/proxy.{ext}").exists() for ext in ("ts", "js")) \
        and any((root / f"app/auth/callback/route.{ext}").exists() for ext in ("ts", "js"))
    add("supabase_wiring", wiring, "Supabase SSR wiring present" if wiring else "Missing lib/supabase or auth callback scaffold")

    supabase_dir = root / "supabase"
    add("supabase_dir", supabase_dir.exists(), "supabase/ present" if supabase_dir.exists() else "Missing supabase/")
    migrations = list((supabase_dir / "migrations").glob("*.sql")) if supabase_dir.exists() else []
    add("migrations", bool(migrations), f"{len(migrations)} migration(s) found" if migrations else "No SQL migrations found")
    add("verification", (supabase_dir / "queries/verification.sql").exists(), "verification.sql present" if (supabase_dir / "queries/verification.sql").exists() else "Missing supabase/queries/verification.sql")

    add("ui_theme", (root / "packages/brand/theme.css").exists(), "packages/brand/theme.css present" if (root / "packages/brand/theme.css").exists() else "Missing packages/brand/theme.css")
    add("ui_blocks_catalog", (root / "packages/blocks/catalog.json").exists(), "packages/blocks/catalog.json present" if (root / "packages/blocks/catalog.json").exists() else "Missing packages/blocks/catalog.json")
    app_surface_layout = (root / "app/(app)/layout.tsx").exists() or (root / "app/(app)/layout.js").exists()
    add("ui_app_surface", app_surface_layout, "App surface layout present" if app_surface_layout else "Missing app/(app)/layout")

    env_values = parse_env_file(env_file)
    add("env_file", env_file.exists(), f"{env_file} present" if env_file.exists() else f"Missing {env_file}")
    add("env_url", bool(env_values.get("NEXT_PUBLIC_SUPABASE_URL")), "NEXT_PUBLIC_SUPABASE_URL present" if env_values.get("NEXT_PUBLIC_SUPABASE_URL") else "Missing NEXT_PUBLIC_SUPABASE_URL")
    add("env_publishable", bool(env_values.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")), "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY present" if env_values.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") else "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    add("env_server_key", bool(env_values.get("SUPABASE_SECRET_KEY") or env_values.get("SUPABASE_SERVICE_ROLE_KEY")), "Server-side key present" if (env_values.get("SUPABASE_SECRET_KEY") or env_values.get("SUPABASE_SERVICE_ROLE_KEY")) else "Missing SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY")

    project_ref = root / "supabase/.temp/project-ref"
    add("remote_link", project_ref.exists() if expect_remote_link else True, "Remote link detected" if project_ref.exists() else ("Remote link not enforced" if not expect_remote_link else "Missing supabase/.temp/project-ref"))

    blockers = [name for name, meta in checks.items() if not meta["ok"] and name not in {"remote_link"}]
    status = "SYSTEM_READY_FOR_DEVELOPMENT" if not blockers and checks["remote_link"]["ok"] else ("ready_with_manual_checks" if not blockers else "blocked")
    return {"status": status, "checks": checks, "blockers": blockers}


def write_markdown(report_path: Path, result: dict[str, object]) -> None:
    checks = result["checks"]
    lines = [f"- {name}: {'sí' if meta['ok'] else 'no'} ({meta['detail']})" for name, meta in checks.items()]
    blockers = "\n".join(f"- {item}" for item in result["blockers"]) if result["blockers"] else "- none"
    content = f"""# System Status

## Estado global
- `{result['status']}`

## Checklist
{chr(10).join(lines)}

## Blockers abiertos
{blockers}
"""
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(content, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Check if a CORTE.App repo is ready for development.")
    parser.add_argument("--root", default=".")
    parser.add_argument("--env-file", default=".env.local")
    parser.add_argument("--report", default=".ai/SYSTEM_STATUS.md")
    parser.add_argument("--expect-remote-link", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    env_file = (root / args.env_file).resolve() if not Path(args.env_file).is_absolute() else Path(args.env_file)
    result = check(root, env_file, args.expect_remote_link)
    report_path = (root / args.report).resolve() if not Path(args.report).is_absolute() else Path(args.report)
    write_markdown(report_path, result)

    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(f"Status: {result['status']}")
        for name, meta in result["checks"].items():
            prefix = "OK" if meta["ok"] else "FAIL"
            print(f"[{prefix}] {name}: {meta['detail']}")
        print(f"Report: {report_path}")

    return 0 if result["status"] in {"SYSTEM_READY_FOR_DEVELOPMENT", "ready_with_manual_checks"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
