export type SharePointBinarySourceKind = "list_attachment" | "document_library" | "local_file"

export type SharePointBinaryFile = {
  id: string
  source_kind: SharePointBinarySourceKind
  sharepoint_site_id: string | null
  sharepoint_list_id: string
  sharepoint_list_title: string | null
  sharepoint_item_id: number
  sharepoint_unique_id: string | null
  sharepoint_etag: string | null
  file_name: string
  server_relative_url: string | null
  web_url: string | null
  content_type: string | null
  file_size: number | string | null
  sha256: string | null
  local_path: string | null
  storage_bucket: string | null
  storage_path: string | null
  destination_table: string | null
  destination_record_id: string | null
  download_status: "pending" | "downloaded" | "uploaded" | "failed" | "skipped"
  error_message: string | null
  raw: unknown
  downloaded_at: string | null
  uploaded_at: string | null
  imported_at: string
}
