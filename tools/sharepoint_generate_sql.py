#!/usr/bin/env python3
"""Generate Supabase SQL from a SharePoint export folder."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SYSTEM_FIELD_NAMES = {
    "_copySource",
    "_EditMenuTableEnd",
    "_EditMenuTableStart",
    "_EditMenuTableStart2",
    "_HasCopyDestinations",
    "_IsCurrentVersion",
    "_Level",
    "_ModerationComments",
    "_ModerationStatus",
    "_UIVersion",
    "_UIVersionString",
    "AppAuthor",
    "AppEditor",
    "Attachments",
    "Author",
    "CheckoutUser",
    "ContentType",
    "ContentTypeId",
    "Created",
    "Created_x0020_Date",
    "DocIcon",
    "Edit",
    "Editor",
    "EncodedAbsUrl",
    "FileDirRef",
    "FileLeafRef",
    "FileRef",
    "FileSizeDisplay",
    "File_x0020_Size",
    "FSObjType",
    "GUID",
    "HTML_x0020_File_x0020_Type",
    "ID",
    "InstanceID",
    "ItemChildCount",
    "Last_x0020_Modified",
    "LinkFilename",
    "LinkFilename2",
    "LinkTitle",
    "LinkTitle2",
    "MetaInfo",
    "Modified",
    "Order",
    "owshiddenversion",
    "PermMask",
    "ProgId",
    "ScopeId",
    "SelectTitle",
    "ServerUrl",
    "SortBehavior",
    "SyncClientId",
    "UniqueId",
    "VirusStatus",
    "WorkflowInstanceID",
    "WorkflowVersion",
}

RESERVED_WORDS = {
    "all",
    "analyse",
    "analyze",
    "and",
    "any",
    "array",
    "as",
    "asc",
    "asymmetric",
    "authorization",
    "binary",
    "both",
    "case",
    "cast",
    "check",
    "collate",
    "column",
    "constraint",
    "create",
    "cross",
    "current_catalog",
    "current_date",
    "current_role",
    "current_schema",
    "current_time",
    "current_timestamp",
    "current_user",
    "default",
    "deferrable",
    "desc",
    "distinct",
    "do",
    "else",
    "end",
    "except",
    "false",
    "fetch",
    "for",
    "foreign",
    "freeze",
    "from",
    "full",
    "grant",
    "group",
    "having",
    "ilike",
    "in",
    "initially",
    "inner",
    "intersect",
    "into",
    "is",
    "isnull",
    "join",
    "lateral",
    "leading",
    "left",
    "like",
    "limit",
    "localtime",
    "localtimestamp",
    "natural",
    "not",
    "notnull",
    "null",
    "offset",
    "on",
    "only",
    "or",
    "order",
    "outer",
    "overlaps",
    "placing",
    "primary",
    "references",
    "returning",
    "right",
    "select",
    "session_user",
    "similar",
    "some",
    "symmetric",
    "table",
    "tablesample",
    "then",
    "to",
    "trailing",
    "true",
    "union",
    "unique",
    "user",
    "using",
    "variadic",
    "verbose",
    "when",
    "where",
    "window",
    "with",
}

TYPE_TO_POSTGRES = {
    "text": "text",
    "note": "text",
    "choice": "text",
    "url": "text",
    "calculated": "text",
    "computed": "text",
    "file": "text",
    "number": "numeric",
    "currency": "numeric",
    "integer": "bigint",
    "counter": "bigint",
    "boolean": "boolean",
    "datetime": "timestamptz",
    "date": "timestamptz",
    "multichoice": "text[]",
}

COMPLEX_TYPES = {
    "lookup",
    "lookupmulti",
    "user",
    "usermulti",
    "taxonomyfieldtype",
    "taxonomyfieldtypemulti",
}


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        if default is not None:
            return default
        raise FileNotFoundError(path)
    return json.loads(path.read_text(encoding="utf-8-sig"))


def ensure_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def clean_guid(value: Any) -> str:
    return str(value or "").strip("{}").lower()


def normalize_identifier(value: Any, prefix: str = "sp", max_len: int = 48) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_").lower()
    if not text:
        text = prefix
    if re.match(r"^[0-9]", text):
        text = f"{prefix}_{text}"
    if text in RESERVED_WORDS:
        text = f"{text}_value"
    if len(text) > max_len:
        digest = hashlib.sha1(text.encode("utf-8")).hexdigest()[:8]
        text = f"{text[: max_len - 9].rstrip('_')}_{digest}"
    return text


def unique_identifier(base: str, used: set[str], max_len: int = 55) -> str:
    candidate = normalize_identifier(base, max_len=max_len)
    if candidate not in used:
        used.add(candidate)
        return candidate

    index = 2
    while True:
        suffix = f"_{index}"
        trimmed = candidate[: max_len - len(suffix)].rstrip("_")
        next_candidate = f"{trimmed}{suffix}"
        if next_candidate not in used:
            used.add(next_candidate)
            return next_candidate
        index += 1


def qi(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def qn(schema: str, table: str) -> str:
    return f"{qi(schema)}.{qi(table)}"


def ql(value: Any) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def field_type(field: dict[str, Any]) -> str:
    return str(field.get("TypeAsString") or "").lower()


def is_multi(field: dict[str, Any]) -> bool:
    type_name = field_type(field)
    return bool(field.get("AllowMultipleValues")) or type_name.endswith("multi") or type_name == "multichoice"


def is_complex(field: dict[str, Any]) -> bool:
    return field_type(field) in COMPLEX_TYPES


def postgres_type(field: dict[str, Any]) -> str:
    type_name = field_type(field)
    if type_name in COMPLEX_TYPES:
        return "jsonb"
    return TYPE_TO_POSTGRES.get(type_name, "text")


def include_field(field: dict[str, Any]) -> bool:
    internal_name = str(field.get("InternalName") or "")
    if not internal_name or internal_name in SYSTEM_FIELD_NAMES:
        return False
    if field.get("Hidden") is True:
        return False
    return True


def is_lookup_to_known_list(field: dict[str, Any], list_ids: set[str]) -> bool:
    lookup_list = clean_guid(field.get("LookupList"))
    return field_type(field).startswith("lookup") and lookup_list in list_ids


def policy_sql(schema: str, table: str, policy_prefix: str) -> list[str]:
    target = qn(schema, table)
    return [
        f"alter table {target} enable row level security;",
        f"grant select, insert, update, delete on {target} to authenticated;",
        f"drop policy if exists {qi(policy_prefix + '_select_authenticated')} on {target};",
        f"""create policy {qi(policy_prefix + '_select_authenticated')}
on {target}
for select
to authenticated
using (public.is_app_user());""",
        f"drop policy if exists {qi(policy_prefix + '_insert_authenticated')} on {target};",
        f"""create policy {qi(policy_prefix + '_insert_authenticated')}
on {target}
for insert
to authenticated
with check (public.is_app_user());""",
        f"drop policy if exists {qi(policy_prefix + '_update_authenticated')} on {target};",
        f"""create policy {qi(policy_prefix + '_update_authenticated')}
on {target}
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());""",
        f"drop policy if exists {qi(policy_prefix + '_delete_authenticated')} on {target};",
        f"""create policy {qi(policy_prefix + '_delete_authenticated')}
on {target}
for delete
to authenticated
using (public.is_app_user());""",
    ]


def constraint_name(*parts: str) -> str:
    text = "_".join(parts)
    return normalize_identifier(text, prefix="c", max_len=60)


def build_manifest(export_dir: Path) -> dict[str, Any]:
    site = read_json(export_dir / "site.json")
    lists = ensure_list(read_json(export_dir / "lists.json"))
    list_ids = {clean_guid(item.get("Id")) for item in lists}

    used_tables: set[str] = set()
    used_bridge_tables: set[str] = set()
    manifest_lists: list[dict[str, Any]] = []

    for list_info in lists:
        list_id = clean_guid(list_info.get("Id"))
        title = str(list_info.get("Title") or list_id)
        base_type = str(list_info.get("BaseType") or "")
        slug = unique_identifier(title, used_tables, max_len=44)
        staging_table = f"sp_{slug}"
        public_table = f"sp_{slug}"
        fields_path = export_dir / "fields" / f"{list_id}.json"
        raw_fields = ensure_list(read_json(fields_path, []))

        used_columns = {
            "id",
            "company_id",
            "source_raw_id",
            "sharepoint_site_id",
            "sharepoint_list_id",
            "sharepoint_item_id",
            "sharepoint_unique_id",
            "sharepoint_etag",
            "sharepoint_modified_at",
            "raw",
            "attachments",
            "documents",
            "imported_at",
            "created_at",
            "updated_at",
        }
        fields: list[dict[str, Any]] = []

        for field in raw_fields:
            if not include_field(field):
                continue

            internal_name = str(field.get("InternalName") or "")
            base_column = unique_identifier(internal_name or field.get("Title") or "field", used_columns, max_len=40)
            pg_type = postgres_type(field)
            lookup_list = clean_guid(field.get("LookupList"))
            target = next((candidate for candidate in lists if clean_guid(candidate.get("Id")) == lookup_list), None)
            known_lookup = is_lookup_to_known_list(field, list_ids)
            multi = is_multi(field)
            complex_type = is_complex(field)
            field_entry: dict[str, Any] = {
                "internal_name": internal_name,
                "title": field.get("Title"),
                "type": field.get("TypeAsString"),
                "pg_type": pg_type,
                "staging_column": base_column,
                "public_column": base_column,
                "is_multi": multi,
                "is_complex": complex_type,
                "lookup_list_id": lookup_list or None,
                "lookup_field": field.get("LookupField") or None,
                "target_list_id": lookup_list if known_lookup else None,
                "target_public_table": None,
                "category": "simple",
            }

            if known_lookup and target:
                target_slug = normalize_identifier(str(target.get("Title") or lookup_list), max_len=44)
                field_entry["target_public_table"] = f"sp_{target_slug}"
                raw_column = unique_identifier(f"{base_column}_raw", used_columns, max_len=48)
                field_entry["raw_column"] = raw_column
                if multi:
                    field_entry["category"] = "lookup_multi"
                    field_entry["public_column"] = raw_column
                    field_entry["bridge_table"] = unique_identifier(
                        f"{public_table}__{base_column}", used_bridge_tables, max_len=55
                    )
                else:
                    field_entry["category"] = "lookup_single"
                    field_entry["public_column"] = raw_column
                    field_entry["fk_column"] = unique_identifier(f"{base_column}_id", used_columns, max_len=48)
                    field_entry["lookup_item_id_column"] = unique_identifier(
                        f"{base_column}_sharepoint_item_id", used_columns, max_len=48
                    )
            elif complex_type:
                field_entry["category"] = "complex"
                field_entry["pg_type"] = "jsonb"

            fields.append(field_entry)

        manifest_lists.append(
            {
                "list_id": list_id,
                "title": title,
                "base_type": base_type,
                "kind": "document_library" if base_type == "DocumentLibrary" else "list",
                "staging_schema": "sharepoint_import",
                "staging_table": staging_table,
                "public_schema": "public",
                "public_table": public_table,
                "fields": fields,
            }
        )

    table_by_list_id = {entry["list_id"]: entry["public_table"] for entry in manifest_lists}
    for entry in manifest_lists:
        for field in entry["fields"]:
            target_id = field.get("target_list_id")
            if target_id and target_id in table_by_list_id:
                field["target_public_table"] = table_by_list_id[target_id]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "site": site,
        "lists": manifest_lists,
    }


def staging_table_sql(entry: dict[str, Any]) -> list[str]:
    columns = [
        "id uuid primary key default gen_random_uuid()",
        "company_id uuid not null references public.companies(id) on delete cascade",
        "sharepoint_site_id text not null",
        "sharepoint_list_id text not null",
        "sharepoint_item_id bigint not null",
        "sharepoint_unique_id text",
        "sharepoint_etag text",
        "sharepoint_modified_at timestamptz",
        "raw jsonb not null default '{}'::jsonb",
        "attachments jsonb not null default '[]'::jsonb",
        "documents jsonb not null default '[]'::jsonb",
        "imported_at timestamptz not null default now()",
    ]
    for field in entry["fields"]:
        columns.append(f"{qi(field['staging_column'])} {field['pg_type']}")

    table = qn(entry["staging_schema"], entry["staging_table"])
    unique_name = constraint_name(entry["staging_table"], "source_unique")
    lines = [
        f"-- Staging for SharePoint {entry['kind']}: {entry['title']}",
        f"create table if not exists {table} (",
        "  " + ",\n  ".join(columns),
        ");",
        f"alter table {table} drop constraint if exists {qi(unique_name)};",
        f"""alter table {table}
  add constraint {qi(unique_name)}
  unique (company_id, sharepoint_site_id, sharepoint_list_id, sharepoint_item_id);""",
        f"create index if not exists {qi('idx_' + entry['staging_table'] + '_company')} on {table} (company_id);",
        f"create index if not exists {qi('idx_' + entry['staging_table'] + '_modified')} on {table} (sharepoint_modified_at desc);",
        f"revoke all on {table} from anon, authenticated;",
        f"grant select, insert, update, delete on {table} to service_role;",
    ]
    return lines


def public_table_sql(entry: dict[str, Any]) -> tuple[list[str], list[str]]:
    columns = [
        "id uuid primary key default gen_random_uuid()",
        "company_id uuid not null references public.companies(id) on delete cascade",
        f"source_raw_id uuid references {qn(entry['staging_schema'], entry['staging_table'])}(id) on delete set null",
        "sharepoint_site_id text not null",
        "sharepoint_list_id text not null",
        "sharepoint_item_id bigint not null",
        "sharepoint_unique_id text",
        "sharepoint_etag text",
        "sharepoint_modified_at timestamptz",
        "imported_at timestamptz not null default now()",
    ]
    fk_lines: list[str] = []

    for field in entry["fields"]:
        category = field["category"]
        if category == "lookup_single":
            columns.append(f"{qi(field['fk_column'])} uuid")
            columns.append(f"{qi(field['lookup_item_id_column'])} bigint")
            columns.append(f"{qi(field['raw_column'])} jsonb")
            if field.get("target_public_table"):
                fk_name = constraint_name(entry["public_table"], field["fk_column"], "fkey")
                fk_lines.extend(
                    [
                        f"alter table {qn('public', entry['public_table'])} drop constraint if exists {qi(fk_name)};",
                        f"""alter table {qn('public', entry['public_table'])}
  add constraint {qi(fk_name)}
  foreign key ({qi(field['fk_column'])}) references {qn('public', field['target_public_table'])}(id) on delete set null;""",
                    ]
                )
        elif category == "lookup_multi":
            columns.append(f"{qi(field['raw_column'])} jsonb")
        else:
            columns.append(f"{qi(field['public_column'])} {field['pg_type']}")

    table = qn("public", entry["public_table"])
    unique_name = constraint_name(entry["public_table"], "source_unique")
    policy_prefix = normalize_identifier(entry["public_table"], max_len=38)
    lines = [
        f"-- Relational model for SharePoint {entry['kind']}: {entry['title']}",
        f"create table if not exists {table} (",
        "  " + ",\n  ".join(columns),
        ");",
        f"alter table {table} drop constraint if exists {qi(unique_name)};",
        f"""alter table {table}
  add constraint {qi(unique_name)}
  unique (company_id, sharepoint_site_id, sharepoint_list_id, sharepoint_item_id);""",
        f"create index if not exists {qi('idx_' + entry['public_table'] + '_company')} on {table} (company_id);",
        f"create index if not exists {qi('idx_' + entry['public_table'] + '_source')} on {table} (sharepoint_list_id, sharepoint_item_id);",
        f"create index if not exists {qi('idx_' + entry['public_table'] + '_modified')} on {table} (sharepoint_modified_at desc);",
        *policy_sql("public", entry["public_table"], policy_prefix),
    ]
    return lines, fk_lines


def bridge_sql(entry: dict[str, Any]) -> tuple[list[str], list[str]]:
    lines: list[str] = []
    fk_lines: list[str] = []

    for field in entry["fields"]:
        if field["category"] != "lookup_multi" or not field.get("target_public_table"):
            continue

        bridge_table = field["bridge_table"]
        target = qn("public", field["target_public_table"])
        source = qn("public", entry["public_table"])
        bridge = qn("public", bridge_table)
        unique_name = constraint_name(bridge_table, "source_target_unique")
        source_fk = constraint_name(bridge_table, "source_id", "fkey")
        target_fk = constraint_name(bridge_table, "target_id", "fkey")

        lines.extend(
            [
                f"-- Bridge for multi lookup {entry['title']}.{field['title']}",
                f"""create table if not exists {bridge} (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_id uuid not null,
  target_id uuid,
  target_sharepoint_item_id bigint not null,
  raw jsonb not null default '{{}}'::jsonb,
  imported_at timestamptz not null default now()
);""",
                f"alter table {bridge} drop constraint if exists {qi(unique_name)};",
                f"""alter table {bridge}
  add constraint {qi(unique_name)}
  unique (company_id, source_id, target_sharepoint_item_id);""",
                f"create index if not exists {qi('idx_' + bridge_table + '_company')} on {bridge} (company_id);",
                f"create index if not exists {qi('idx_' + bridge_table + '_source')} on {bridge} (source_id);",
                f"create index if not exists {qi('idx_' + bridge_table + '_target')} on {bridge} (target_id);",
                *policy_sql("public", bridge_table, normalize_identifier(bridge_table, max_len=38)),
            ]
        )

        fk_lines.extend(
            [
                f"alter table {bridge} drop constraint if exists {qi(source_fk)};",
                f"""alter table {bridge}
  add constraint {qi(source_fk)}
  foreign key (source_id) references {source}(id) on delete cascade;""",
                f"alter table {bridge} drop constraint if exists {qi(target_fk)};",
                f"""alter table {bridge}
  add constraint {qi(target_fk)}
  foreign key (target_id) references {target}(id) on delete set null;""",
            ]
        )

    return lines, fk_lines


def generate_sql(manifest: dict[str, Any]) -> str:
    lines = [
        "-- Generated by tools/sharepoint_generate_sql.py.",
        "-- Re-run the generator after refreshing .sharepoint-export.",
        "begin;",
        "create schema if not exists sharepoint_import;",
        "revoke all on schema sharepoint_import from anon, authenticated;",
        "grant usage on schema sharepoint_import to service_role;",
    ]
    deferred_fk_lines: list[str] = []

    for entry in manifest["lists"]:
        lines.append("")
        lines.extend(staging_table_sql(entry))

    for entry in manifest["lists"]:
        lines.append("")
        table_lines, fk_lines = public_table_sql(entry)
        lines.extend(table_lines)
        deferred_fk_lines.extend(fk_lines)

    for entry in manifest["lists"]:
        bridge_lines, bridge_fk_lines = bridge_sql(entry)
        if bridge_lines:
            lines.append("")
            lines.extend(bridge_lines)
        deferred_fk_lines.extend(bridge_fk_lines)

    if deferred_fk_lines:
        lines.append("")
        lines.append("-- Deferred foreign keys after all generated tables exist.")
        lines.extend(deferred_fk_lines)

    lines.extend(
        [
            "",
            "grant usage, select on all sequences in schema public to authenticated;",
            "commit;",
            "",
        ]
    )
    return "\n".join(lines)


def default_migration_path(root: Path) -> Path:
    migrations_dir = root / "supabase" / "migrations"
    existing_generated = sorted(migrations_dir.glob("*_sharepoint_generated_model.sql"))
    if existing_generated:
        return existing_generated[-1]

    versions: list[int] = []
    for path in migrations_dir.glob("*.sql"):
        match = re.match(r"^(\d{14})_", path.name)
        if match:
            versions.append(int(match.group(1)))

    next_version = max(versions, default=0) + 1
    return migrations_dir / f"{next_version:014d}_sharepoint_generated_model.sql"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Supabase SQL from SharePoint JSON export.")
    parser.add_argument("--export-dir", default=".sharepoint-export")
    parser.add_argument("--out", default="")
    parser.add_argument("--manifest-out", default="")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    root = Path.cwd()
    export_dir = Path(args.export_dir)
    if not export_dir.is_absolute():
        export_dir = root / export_dir

    manifest = build_manifest(export_dir)
    sql = generate_sql(manifest)
    out_path = Path(args.out) if args.out else default_migration_path(root)
    if not out_path.is_absolute():
        out_path = root / out_path

    manifest_out = Path(args.manifest_out) if args.manifest_out else export_dir / "sql_manifest.json"
    if not manifest_out.is_absolute():
        manifest_out = root / manifest_out

    if args.dry_run:
        print(sql)
        return 0

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(sql, encoding="utf-8")
    manifest_out.parent.mkdir(parents=True, exist_ok=True)
    manifest_out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {out_path}")
    print(f"Wrote {manifest_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
