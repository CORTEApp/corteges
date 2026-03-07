#!/usr/bin/env python3
"""Extract only the three allowed audit documents from a folder or zip bundle."""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import zipfile
from pathlib import Path

ALLOWED = [
    '03_Plantilla_Proceso_Actual.docx',
    '05_Plantilla_Diseno_Proceso_Propuesto.docx',
    '06_Plantilla_Resumen_Ejecutivo_Direccion.docx',
]
ALLOWED_SET = set(ALLOWED)


def extract_from_zip(source: Path, out_dir: Path) -> dict:
    manifest = {'source': str(source), 'used': [], 'ignored': [], 'missing': []}
    with zipfile.ZipFile(source) as zf:
        members = zf.infolist()
        by_basename: dict[str, zipfile.ZipInfo] = {}
        for member in members:
            if member.is_dir():
                continue
            basename = Path(member.filename).name
            if basename in ALLOWED_SET and basename not in by_basename:
                by_basename[basename] = member
            else:
                manifest['ignored'].append(member.filename)
        for wanted in ALLOWED:
            member = by_basename.get(wanted)
            if member is None:
                manifest['missing'].append(wanted)
                continue
            target = out_dir / wanted
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(member) as src, target.open('wb') as dst:
                shutil.copyfileobj(src, dst)
            manifest['used'].append(member.filename)
    return manifest


def extract_from_dir(source: Path, out_dir: Path) -> dict:
    manifest = {'source': str(source), 'used': [], 'ignored': [], 'missing': []}
    found: dict[str, Path] = {}
    for path in source.rglob('*'):
        if not path.is_file():
            continue
        basename = path.name
        if basename in ALLOWED_SET and basename not in found:
            found[basename] = path
        else:
            manifest['ignored'].append(str(path.relative_to(source)))
    for wanted in ALLOWED:
        match = found.get(wanted)
        if match is None:
            manifest['missing'].append(wanted)
            continue
        target = out_dir / wanted
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(match, target)
        manifest['used'].append(str(match.relative_to(source)))
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('--out', type=Path, default=Path('.ai/_audit_bundle'))
    args = parser.parse_args()

    source = args.source.expanduser().resolve()
    out_dir = args.out.expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if source.is_file() and source.suffix.lower() == '.zip':
        manifest = extract_from_zip(source, out_dir)
    elif source.is_dir():
        manifest = extract_from_dir(source, out_dir)
    else:
        print(f'Unsupported source: {source}', file=sys.stderr)
        return 2

    manifest_path = out_dir / 'manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')

    if manifest['missing']:
        print(json.dumps(manifest, indent=2, ensure_ascii=False), file=sys.stderr)
        return 1

    print(json.dumps(manifest, indent=2, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
