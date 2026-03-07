#!/usr/bin/env python3
"""Create a Next.js + shadcn/ui base inside a repo that already contains the agent system."""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path

ALLOWED_ROOT_FILES = {
    'package.json',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'bun.lockb',
    'tsconfig.json',
    'jsconfig.json',
    'next-env.d.ts',
    'next.config.ts',
    'next.config.js',
    'next.config.mjs',
    'postcss.config.js',
    'postcss.config.mjs',
    'eslint.config.js',
    'eslint.config.mjs',
}
ALLOWED_DIRS = {'app', 'public', 'src'}
DEFAULT_SHADCN_COMPONENTS = ['button', 'card', 'input', 'label', 'separator', 'badge', 'sheet', 'dropdown-menu', 'avatar', 'table', 'textarea', 'skeleton', 'dialog', 'sonner']


def resolve_runner(binary: str) -> str:
    """Use Windows .cmd launchers when needed for Node ecosystem CLIs."""
    if os.name == 'nt' and not binary.endswith('.cmd'):
        return f'{binary}.cmd'
    return binary


def run(cmd: list[str], cwd: Path, dry_run: bool) -> None:
    print('$', ' '.join(cmd))
    if dry_run:
        return
    subprocess.run(cmd, cwd=str(cwd), check=True)


def merge_generated_app(temp_dir: Path, repo_root: Path) -> list[str]:
    touched: list[str] = []
    for item in temp_dir.iterdir():
        target = repo_root / item.name
        if item.name in ALLOWED_ROOT_FILES:
            shutil.copy2(item, target)
            touched.append(item.name)
        elif item.name in ALLOWED_DIRS:
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(item, target)
            touched.append(item.name + '/')
    return touched


def overlay_scaffold(scaffold_root: Path, repo_root: Path) -> list[str]:
    touched: list[str] = []
    for path in scaffold_root.rglob('*'):
        if path.is_dir():
            continue
        rel = path.relative_to(scaffold_root)
        target = repo_root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        touched.append(str(rel))
    return touched


def ensure_components_json(repo_root: Path) -> None:
    template = repo_root / 'scaffolds/nextjs/components.json.template'
    target = repo_root / 'components.json'
    if not target.exists() and template.exists():
        shutil.copy2(template, target)


def patch_package_json(repo_root: Path) -> None:
    package_json = repo_root / 'package.json'
    if not package_json.exists():
        return
    data = json.loads(package_json.read_text(encoding='utf-8'))
    deps = data.setdefault('dependencies', {})
    deps.setdefault('@supabase/ssr', '^0.5.2')
    deps.setdefault('@supabase/supabase-js', '^2.50.0')
    deps.setdefault('lucide-react', '^0.511.0')
    deps.setdefault('sonner', '^1.7.4')
    deps.setdefault('clsx', '^2.1.1')
    deps.setdefault('tailwind-merge', '^2.5.4')
    deps.setdefault('class-variance-authority', '^0.7.1')
    scripts = data.setdefault('scripts', {})
    scripts.setdefault('audit:ui-system', 'python tools/ui_system_audit.py --root . --report MERGE_AUDIT_REPORT.md')
    package_json.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')


def read_manifest(repo_root: Path) -> dict:
    return json.loads((repo_root / 'scaffolds/nextjs/project-init.manifest.json').read_text(encoding='utf-8'))


def main() -> int:
    parser = argparse.ArgumentParser(description='Initialize Next.js + shadcn/ui inside a repo that already has the agent system.')
    parser.add_argument('--repo-root', default='.')
    parser.add_argument('--pm', default='npm', choices=['npm', 'pnpm', 'yarn', 'bun'])
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--skip-shadcn', action='store_true')
    parser.add_argument('--force-clean-temp', action='store_true')
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    temp_dir = repo_root / 'tmp_next_bootstrap'
    scaffold_root = repo_root / 'scaffolds/nextjs/files'
    manifest = read_manifest(repo_root)

    if temp_dir.exists():
        if args.force_clean_temp:
            shutil.rmtree(temp_dir)
        else:
            raise SystemExit(f'Temporary bootstrap directory already exists: {temp_dir}. Use --force-clean-temp to remove it.')

    create_cmd = manifest['create_next_app']['command'][:]
    runner_map = {
        'npm': [resolve_runner('npx')],
        'pnpm': [resolve_runner('pnpm'), 'dlx'],
        'yarn': [resolve_runner('yarn'), 'dlx'],
        'bun': [resolve_runner('bunx')],
    }
    pm_flag_map = {
        '--use-npm': {'npm': '--use-npm', 'pnpm': '--use-pnpm', 'yarn': '--use-yarn', 'bun': '--use-bun'}
    }
    create_cmd = runner_map[args.pm] + create_cmd[1:]
    # Keep create-next-app target folder aligned with our runtime temp directory name.
    if len(create_cmd) >= 3:
        create_cmd[2] = temp_dir.name
    if '--yes' not in create_cmd:
        create_cmd.append('--yes')
    for old_flag, mapping in pm_flag_map.items():
        if old_flag in create_cmd:
            create_cmd[create_cmd.index(old_flag)] = mapping[args.pm]

    run(create_cmd, repo_root, args.dry_run)
    if not args.dry_run and not temp_dir.exists():
        raise SystemExit(f'create-next-app did not create temp directory: {temp_dir}')

    touched: list[str] = []
    if not args.dry_run:
        touched.extend(merge_generated_app(temp_dir, repo_root))
        patch_package_json(repo_root)
        ensure_components_json(repo_root)

        if not args.skip_shadcn:
            shadcn_runner = runner_map[args.pm]
            run(shadcn_runner + ['shadcn@latest', 'init', '-y'], repo_root, False)
            for component in DEFAULT_SHADCN_COMPONENTS:
                run(shadcn_runner + ['shadcn@latest', 'add', component, '-y'], repo_root, False)

        touched.extend(overlay_scaffold(scaffold_root, repo_root))
        if temp_dir.exists():
            shutil.rmtree(temp_dir)

    report = repo_root / '.ai/BOOTSTRAP_REPORT.md'
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(
        '# Bootstrap Report\n\n'
        '## Project init\n'
        '- scaffold profile: `marketing+app ui fusion`\n'
        f'- repo root: `{repo_root}`\n'
        f'- package manager: `{args.pm}`\n'
        f'- dry run: `{args.dry_run}`\n'
        f'- touched files: `{len(touched)}`\n',
        encoding='utf-8',
    )
    print('Project init prepared.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
