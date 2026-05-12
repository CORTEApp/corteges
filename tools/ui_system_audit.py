#!/usr/bin/env python3
"""Static audit for the fused UI scaffold and CORTE.Ges visual contract."""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable

PAGE_EXTS = ('.tsx', '.ts', '.jsx', '.js')
IMPORT_RE = re.compile(r"from\s+[\"'](@/[^\"']+)[\"']")
# Supports href="/x", href:'/x', href={"/x"} and object literals like href: "/x"
HREF_RE = re.compile(r"href\s*[:=]\s*(?:\{\s*)?[\"'](/[^\"'?#}]*)")
FORBIDDEN_DOC_PATTERNS = ['apps/web', 'pnpm-workspace.yaml']
IGNORED_DIRS = {'.git', '.next', 'node_modules', 'scaffolds'}
VISUAL_RUNTIME_DIRS = ('app', 'components', 'public', 'packages/brand')
FORBIDDEN_VISUAL_PATTERNS = {
    'graphite_jade': 'el preset Graphite/Jade no pertenece a CORTE.Ges Atlas',
    'bg-emerald': 'las clases emerald introducen verde fuera de Atlas Blue',
    'text-emerald': 'las clases emerald introducen verde fuera de Atlas Blue',
    'border-emerald': 'las clases emerald introducen verde fuera de Atlas Blue',
    'richColors': 'los toasts con richColors pueden saltarse los tokens visuales',
    'CORTE.App Starter': 'copy de starter visible',
    'CORTE.Ges Starter': 'copy de starter visible',
    'Solicitar demo': 'copy de landing generica visible',
    'Ver casos': 'copy de landing generica visible',
    'Procesos mas claros': 'copy de landing generica visible',
    'Procesos más claros': 'copy de landing generica visible',
    'magic link': 'copy generico de auth visible',
}
STARTER_PUBLIC_ASSETS = (
    'public/next.svg',
    'public/vercel.svg',
    'public/file.svg',
    'public/globe.svg',
    'public/window.svg',
)


def normalize_route(parts: Iterable[str]) -> str:
    clean: list[str] = []
    for part in parts:
        if part.startswith('(') and part.endswith(')'):
            continue
        if part == 'page':
            continue
        clean.append(part)
    route = '/' + '/'.join(clean)
    return route or '/'


def route_for(path: Path, app_root: Path) -> tuple[str, str]:
    rel = path.relative_to(app_root)
    parts = list(rel.parts)
    stem = path.stem
    route = normalize_route(parts[:-1] + [stem])
    kind = 'route' if stem == 'route' else 'page'
    return route, kind


def resolve_alias(root: Path, alias_path: str) -> bool:
    rel = alias_path.removeprefix('@/')
    base = root / rel
    candidates = [base]
    if base.suffix == '':
        for ext in ('.tsx', '.ts', '.jsx', '.js', '.json', '.css', '.md'):
            candidates.append(base.with_suffix(ext))
        for ext in ('.tsx', '.ts', '.jsx', '.js'):
            candidates.append(base / ('index' + ext))
    if any(candidate.exists() for candidate in candidates):
        return True

    scaffold_base = root / 'scaffolds/nextjs/files' / rel
    scaffold_candidates = [scaffold_base]
    if scaffold_base.suffix == '':
        for ext in ('.tsx', '.ts', '.jsx', '.js', '.json', '.css', '.md'):
            scaffold_candidates.append(scaffold_base.with_suffix(ext))
        for ext in ('.tsx', '.ts', '.jsx', '.js'):
            scaffold_candidates.append(scaffold_base / ('index' + ext))
    return any(candidate.exists() for candidate in scaffold_candidates)


def shadcn_component_declared(root: Path, alias_path: str) -> bool:
    prefix = '@/components/ui/'
    if not alias_path.startswith(prefix):
        return False
    component_name = alias_path.removeprefix(prefix).split('/')[0]
    declared = root / 'scaffolds/nextjs/shadcn-components.txt'
    if not declared.exists():
        return False
    names = {line.strip() for line in declared.read_text(encoding='utf-8').splitlines() if line.strip()}
    return component_name in names


def collect_text_files(root: Path) -> list[Path]:
    keep: list[Path] = []
    for path in root.rglob('*'):
        if any(part in IGNORED_DIRS for part in path.parts):
            continue
        if path.is_dir():
            continue
        if path.suffix.lower() in {'.ts', '.tsx', '.js', '.jsx', '.md', '.json', '.css'}:
            keep.append(path)
    return keep


def read_text(path: Path) -> str:
    if not path.exists():
        return ''
    return path.read_text(encoding='utf-8')


def validate_visual_contract(root: Path, issues: list[str], stats: dict[str, object]) -> None:
    contract_path = root / '.ai/VISUAL_CONTRACT.md'
    layout_path = root / 'app/layout.tsx'
    globals_path = root / 'app/globals.css'
    theme_path = root / 'packages/brand/theme.css'

    if not contract_path.exists():
        issues.append('Falta .ai/VISUAL_CONTRACT.md con el contrato CORTE.Ges/Edisol Atlas')

    layout = read_text(layout_path)
    if not layout:
        issues.append('Falta app/layout.tsx para validar bootstrap visual')
    else:
        layout_normalized = layout.replace("'", '"')
        required_layout = {
            'Plus_Jakarta_Sans': 'app/layout.tsx debe cargar Plus_Jakarta_Sans',
            'theme-bootstrap': 'app/layout.tsx debe ejecutar el bootstrap visual antes del primer paint',
            'saas_atlas_blue_v2': 'app/layout.tsx debe fijar data-preset saas_atlas_blue_v2',
            'medium': 'app/layout.tsx debe fijar data-font-size medium',
            '--font-generated-sans': 'app/layout.tsx debe exponer la fuente como --font-generated-sans',
            '/brand/corteges/logo-mark.svg': 'app/layout.tsx debe declarar el logo CORTE.Ges',
        }
        for needle, message in required_layout.items():
            if needle not in layout_normalized:
                issues.append(message)

    theme = read_text(theme_path)
    if not theme:
        issues.append('Falta packages/brand/theme.css para validar tokens Atlas')
    else:
        theme_normalized = theme.replace("'", '"')
        required_theme = {
            'data-preset="saas_atlas_blue_v2"': 'theme.css debe declarar :root[data-preset="saas_atlas_blue_v2"]',
            'data-font-size="medium"': 'theme.css debe declarar :root[data-font-size="medium"]',
            '--font-size-base: 14px': 'theme.css debe fijar medium en 14px',
            '--primary': 'theme.css debe exponer --primary',
            '--field-filled': 'theme.css debe exponer --field-filled',
            '--layout-max-width: clamp(80rem, calc(100vw - 24rem), 140rem)': 'theme.css debe mantener el ancho operativo fluido de CORTE.Ges',
            '--surface-1': 'theme.css debe exponer --surface-1',
            '--surface-2': 'theme.css debe exponer --surface-2',
            '--surface-3': 'theme.css debe exponer --surface-3',
            '--sidebar': 'theme.css debe exponer --sidebar',
            '--sidebar-border': 'theme.css debe exponer --sidebar-border',
            '--sidebar-accent': 'theme.css debe exponer --sidebar-accent',
            '--sidebar-active': 'theme.css debe exponer --sidebar-active',
        }
        for needle, message in required_theme.items():
            if needle not in theme_normalized:
                issues.append(message)

    globals_css = read_text(globals_path)
    if not globals_css:
        issues.append('Falta app/globals.css para validar la fuente global')
    else:
        if '../packages/brand/theme.css' not in globals_css:
            issues.append('app/globals.css debe importar packages/brand/theme.css')
        if '--font-generated-sans' not in globals_css:
            issues.append('app/globals.css debe aplicar var(--font-generated-sans) como fuente base')

    for asset in STARTER_PUBLIC_ASSETS:
        if (root / asset).exists():
            issues.append(f'Asset starter prohibido presente: {asset}')

    runtime_files = []
    for directory in VISUAL_RUNTIME_DIRS:
        target = root / directory
        if target.exists():
            runtime_files.extend(collect_text_files(target))
    for path in runtime_files:
        text = path.read_text(encoding='utf-8')
        normalized_text = text.casefold()
        for pattern, reason in FORBIDDEN_VISUAL_PATTERNS.items():
            if pattern.casefold() in normalized_text:
                issues.append(f'Patron visual prohibido `{pattern}` en {path.relative_to(root)}: {reason}')

    stats['visual_contract'] = 'checked'
    stats['visual_runtime_files'] = len(runtime_files)


def main() -> int:
    parser = argparse.ArgumentParser(description='Audit the fused UI scaffold.')
    parser.add_argument('--root', default='.')
    parser.add_argument('--report', default='MERGE_AUDIT_REPORT.md')
    parser.add_argument('--json-out', default='MERGE_AUDIT_REPORT.json')
    args = parser.parse_args()

    root = Path(args.root).resolve()
    scaffold = root / 'scaffolds/nextjs/files'
    app_root = root / 'app'
    if not app_root.exists():
        app_root = scaffold / 'app'

    issues: list[str] = []
    warnings: list[str] = []
    stats: dict[str, object] = {}

    page_routes: defaultdict[str, list[str]] = defaultdict(list)
    route_handlers: defaultdict[str, list[str]] = defaultdict(list)

    for path in app_root.rglob('*'):
        if not path.is_file() or path.suffix not in PAGE_EXTS:
            continue
        if path.stem not in {'page', 'route'}:
            continue
        route, kind = route_for(path, app_root)
        (page_routes if kind == 'page' else route_handlers)[route].append(str(path.relative_to(root)))

    duplicate_pages = {route: files for route, files in page_routes.items() if len(files) > 1}
    if duplicate_pages:
        for route, files in duplicate_pages.items():
            issues.append(f'Ruta duplicada {route}: {files}')

    hrefs: Counter[str] = Counter()
    missing_routes: list[str] = []
    missing_imports: list[str] = []

    scan_roots = [root / name for name in ('app', 'components', 'lib', 'packages') if (root / name).exists()]
    for scan_root in scan_roots:
        for path in collect_text_files(scan_root):
            text = path.read_text(encoding='utf-8')
            for href in HREF_RE.findall(text):
                if href.startswith('/_next'):
                    continue
                hrefs[href] += 1
                if href not in page_routes and href not in route_handlers:
                    missing_routes.append(f'{href} referenced in {path.relative_to(root)}')
            for alias in IMPORT_RE.findall(text):
                if not resolve_alias(root, alias) and not shadcn_component_declared(root, alias):
                    missing_imports.append(f'{alias} referenced in {path.relative_to(root)}')

    if missing_routes:
        issues.extend(sorted(set(missing_routes)))
    if missing_imports:
        issues.extend(sorted(set(missing_imports)))

    catalog_path = root / 'packages/blocks/catalog.json'
    if not catalog_path.exists():
        catalog_path = scaffold / 'packages/blocks/catalog.json'
    registry_path = root / 'packages/registry/r/registry.json'
    if not registry_path.exists():
        registry_path = scaffold / 'packages/registry/r/registry.json'
    if catalog_path.exists():
        catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
        block_ids = [block['id'] for block in catalog.get('blocks', [])]
        dup_block_ids = [item for item, count in Counter(block_ids).items() if count > 1]
        if dup_block_ids:
            issues.append(f'IDs duplicados en catalog.json: {dup_block_ids}')
        stats['block_count'] = len(block_ids)
    else:
        issues.append('Falta packages/blocks/catalog.json en el scaffold')

    if registry_path.exists():
        registry = json.loads(registry_path.read_text(encoding='utf-8'))
        reg_names = [item['name'] for item in registry.get('items', [])]
        dup_reg_names = [item for item, count in Counter(reg_names).items() if count > 1]
        if dup_reg_names:
            issues.append(f'Nombres duplicados en registry.json: {dup_reg_names}')
        stats['registry_items'] = len(reg_names)
    else:
        warnings.append('Falta packages/registry/r/registry.json en el scaffold')

    docs_to_scan = [root / 'README.md', root / 'AGENTS.md', root / 'docs']
    for target in docs_to_scan:
        targets = [target] if target.is_file() else list(target.rglob('*.md')) if target.exists() else []
        for path in targets:
            text = path.read_text(encoding='utf-8')
            for pattern in FORBIDDEN_DOC_PATTERNS:
                if pattern in text:
                    warnings.append(f'Referencia potencialmente contradictoria `{pattern}` en {path.relative_to(root)}')

    validate_visual_contract(root, issues, stats)

    status = 'PASS' if not issues else 'FAIL'
    stats['page_routes'] = len(page_routes)
    stats['route_handlers'] = len(route_handlers)
    stats['internal_hrefs'] = sum(hrefs.values())

    report_lines = [
        '# Merge Audit Report',
        '',
        f'- status: `{status}`',
        f'- page routes detectadas: `{stats["page_routes"]}`',
        f'- route handlers detectados: `{stats["route_handlers"]}`',
        f'- hrefs internas detectadas: `{stats["internal_hrefs"]}`',
        f'- bloques en catálogo: `{stats.get("block_count", 0)}`',
        f'- items en registry: `{stats.get("registry_items", 0)}`',
        f'- contrato visual: `{stats.get("visual_contract", "not_checked")}`',
        f'- ficheros runtime visual revisados: `{stats.get("visual_runtime_files", 0)}`',
        '',
        '## Rutas detectadas',
    ]
    for route, files in sorted(page_routes.items()):
        report_lines.append(f'- {route}: {", ".join(files)}')
    report_lines.extend(['', '## Issues'])
    if issues:
        report_lines.extend(f'- {item}' for item in issues)
    else:
        report_lines.append('- none')
    report_lines.extend(['', '## Warnings'])
    if warnings:
        report_lines.extend(f'- {item}' for item in warnings)
    else:
        report_lines.append('- none')

    report_path = root / args.report
    report_path.write_text('\n'.join(report_lines) + '\n', encoding='utf-8')

    json_path = root / args.json_out
    json_path.write_text(
        json.dumps({'status': status, 'stats': stats, 'issues': issues, 'warnings': warnings}, indent=2, ensure_ascii=False) + '\n',
        encoding='utf-8',
    )

    print(status)
    return 0 if status == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
