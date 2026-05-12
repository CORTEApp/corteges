param(
  [string]$SiteUrl = $env:SHAREPOINT_SITE_URL,
  [string]$OutDir = $(if ($env:SHAREPOINT_EXPORT_DIR) { $env:SHAREPOINT_EXPORT_DIR } else { ".sharepoint-export" }),
  [string]$EnvFile = "",
  [string]$ClientId = $env:ENTRAID_CLIENT_ID,
  [string]$ClientSecret = $env:M365_CLIENT_SECRET,
  [string]$Tenant = $(if ($env:ENTRAID_TENANT_ID) { $env:ENTRAID_TENANT_ID } elseif ($env:ENTRAID_TENANT) { $env:ENTRAID_TENANT } elseif ($env:SHAREPOINT_TENANT) { $env:SHAREPOINT_TENANT } else { "" }),
  [string[]]$ListId = @(),
  [string[]]$Extensions = @(),
  [ValidateSet("Interactive", "DeviceLogin", "OSLogin", "AppOnly")]
  [string]$AuthMode = "Interactive",
  [switch]$DryRun,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

function Import-DotEnv {
  param([string]$Path)

  if (-not $Path -or -not (Test-Path -LiteralPath $Path)) {
    return
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
      continue
    }

    $separator = $trimmed.IndexOf("=")
    $key = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim().Trim('"').Trim("'")
    if ($key) {
      Set-Item -Path "env:$key" -Value $value
    }
  }
}

function Get-ObjectValue {
  param(
    [object]$Object,
    [string]$Name
  )

  if ($null -eq $Object) {
    return $null
  }

  $property = $Object.PSObject.Properties[$Name]
  if ($property) {
    return $property.Value
  }

  return $null
}

function Convert-GuidText {
  param([object]$Value)
  return ([string]$Value).Trim().Trim("{").Trim("}").ToLowerInvariant()
}

function Convert-SafeFileName {
  param([string]$Name)

  $safe = [string]$Name
  foreach ($char in [IO.Path]::GetInvalidFileNameChars()) {
    $safe = $safe.Replace([string]$char, "_")
  }

  $safe = $safe.Trim()
  if (-not $safe) {
    return "sharepoint-file"
  }

  return $safe
}

function Convert-ToServerRelativeUrl {
  param([string]$Url)

  if (-not $Url) {
    return ""
  }

  if ($Url -match "^https?://") {
    return ([Uri]$Url).AbsolutePath
  }

  return $Url
}

function Convert-ToFilterValues {
  param(
    [string[]]$Values,
    [switch]$Guid,
    [switch]$Extension
  )

  $result = @()
  foreach ($value in $Values) {
    foreach ($part in ([string]$value).Split(",", [StringSplitOptions]::RemoveEmptyEntries)) {
      $trimmed = $part.Trim()
      if (-not $trimmed) {
        continue
      }

      if ($Guid) {
        $result += Convert-GuidText $trimmed
      } elseif ($Extension) {
        $normalized = $trimmed.ToLowerInvariant()
        if (-not $normalized.StartsWith(".")) {
          $normalized = ".$normalized"
        }
        $result += $normalized
      } else {
        $result += $trimmed
      }
    }
  }

  return @($result | Where-Object { $_ } | Select-Object -Unique)
}

function Test-ListFilter {
  param(
    [string]$ListId,
    [string[]]$AllowedListIds
  )

  return ($AllowedListIds.Count -eq 0 -or $AllowedListIds.Contains((Convert-GuidText $ListId)))
}

function Test-ExtensionFilter {
  param(
    [string]$FileName,
    [string[]]$AllowedExtensions
  )

  if ($AllowedExtensions.Count -eq 0) {
    return $true
  }

  $extension = [IO.Path]::GetExtension($FileName).ToLowerInvariant()
  return $AllowedExtensions.Contains($extension)
}

function Test-HasAttachmentFlag {
  param([object]$Item)

  $values = Get-ObjectValue -Object $Item -Name "Values"
  $flag = Get-ObjectValue -Object $values -Name "Attachments"
  if ($flag -eq $true -or $flag -eq 1 -or ([string]$flag).ToLowerInvariant() -eq "true") {
    return $true
  }

  $attachments = Get-ObjectValue -Object $Item -Name "Attachments"
  return ($attachments -and $attachments.Count -gt 0)
}

function Get-RelativeExportPath {
  param(
    [string]$ExportRoot,
    [string]$Path
  )

  $root = [IO.Path]::GetFullPath($ExportRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $full = [IO.Path]::GetFullPath($Path)
  if ($full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
    return $full.Substring($root.Length).TrimStart([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar).Replace("\", "/")
  }

  return $full.Replace("\", "/")
}

Import-DotEnv -Path ".env.local"
Import-DotEnv -Path "..\m365.env"
Import-DotEnv -Path "C:\GitHub\edisolv2\m365.env"
if ($EnvFile) {
  Import-DotEnv -Path $EnvFile
}

if (-not $SiteUrl) {
  $SiteUrl = $env:SHAREPOINT_SITE_URL
}

if (-not $ClientId) {
  $ClientId = $env:ENTRAID_CLIENT_ID
}

if ((-not $ClientId) -or $AuthMode -eq "AppOnly") {
  if ($env:M365_CLIENT_ID) {
    $ClientId = $env:M365_CLIENT_ID
  }
}

if (-not $ClientSecret) {
  $ClientSecret = $env:M365_CLIENT_SECRET
}

if (-not $Tenant) {
  $Tenant = $env:ENTRAID_TENANT_ID
}

if (-not $Tenant) {
  $Tenant = $env:M365_TENANT_ID
}

if (-not $Tenant -and $SiteUrl) {
  $hostName = ([Uri]$SiteUrl).Host
  if ($hostName -match "^([^.]+)\.sharepoint\.com$") {
    $Tenant = "$($Matches[1]).onmicrosoft.com"
  }
}

$resolvedOutDir = [IO.Path]::GetFullPath((Join-Path (Resolve-Path -LiteralPath ".") $OutDir))
$listsPath = Join-Path $resolvedOutDir "lists.json"
$itemsDir = Join-Path $resolvedOutDir "items"
$sitePath = Join-Path $resolvedOutDir "site.json"

if (-not (Test-Path -LiteralPath $listsPath)) {
  throw "Missing SharePoint lists export: $listsPath"
}

if (-not (Test-Path -LiteralPath $itemsDir)) {
  throw "Missing SharePoint items export: $itemsDir"
}

$lists = Get-Content -LiteralPath $listsPath -Raw | ConvertFrom-Json
$site = if (Test-Path -LiteralPath $sitePath) { Get-Content -LiteralPath $sitePath -Raw | ConvertFrom-Json } else { $null }
$targetLists = @()
$summary = [ordered]@{}
$allowedListIds = Convert-ToFilterValues -Values $ListId -Guid
$allowedExtensions = Convert-ToFilterValues -Values $Extensions -Extension

foreach ($list in $lists) {
  $listId = Convert-GuidText (Get-ObjectValue -Object $list -Name "Id")
  if (-not (Test-ListFilter -ListId $listId -AllowedListIds $allowedListIds)) {
    continue
  }

  $itemsPath = Join-Path $itemsDir "$listId.json"
  if (-not (Test-Path -LiteralPath $itemsPath)) {
    continue
  }

  $items = Get-Content -LiteralPath $itemsPath -Raw | ConvertFrom-Json
  $baseType = [string](Get-ObjectValue -Object $list -Name "BaseType")
  $flaggedItems = @($items | Where-Object { Test-HasAttachmentFlag -Item $_ })
  $documentItems = @()

  if ($baseType -eq "DocumentLibrary") {
    $documentItems = @($items | Where-Object {
      $documents = Get-ObjectValue -Object $_ -Name "Documents"
      $documents -and $documents.Count -gt 0
    })
  }

  if ($flaggedItems.Count -eq 0 -and $documentItems.Count -eq 0) {
    continue
  }

  $targetLists += [ordered]@{
    List = $list
    ListId = $listId
    Items = $items
    FlaggedItems = $flaggedItems
    DocumentItems = $documentItems
  }

  $summary[[string](Get-ObjectValue -Object $list -Name "Title")] = [ordered]@{
    list_id = $listId
    attachment_item_count = $flaggedItems.Count
    document_item_count = $documentItems.Count
  }
}

Write-Host "SharePoint binary candidates:"
foreach ($name in $summary.Keys) {
  $entry = $summary[$name]
  Write-Host ("- {0}: attachments={1} documents={2}" -f $name, $entry.attachment_item_count, $entry.document_item_count)
}

if ($DryRun) {
  return
}

if (-not $SiteUrl) {
  throw "Missing SHAREPOINT_SITE_URL. Set it in .env.local, m365 env or pass -SiteUrl."
}

if (-not $ClientId) {
  throw "Missing ENTRAID_CLIENT_ID or M365_CLIENT_ID."
}

if ($AuthMode -eq "AppOnly" -and -not $ClientSecret) {
  throw "Missing M365_CLIENT_SECRET for AppOnly auth."
}

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
  throw "PnP.PowerShell is not installed. Install-Module PnP.PowerShell -Scope CurrentUser"
}

Import-Module PnP.PowerShell

$connectArgs = @{
  Url = $SiteUrl
  ClientId = $ClientId
}

if ($Tenant) {
  $connectArgs["Tenant"] = $Tenant
}

if ($AuthMode -eq "DeviceLogin") {
  Connect-PnPOnline @connectArgs -DeviceLogin
} elseif ($AuthMode -eq "OSLogin") {
  Connect-PnPOnline @connectArgs -OSLogin
} elseif ($AuthMode -eq "AppOnly") {
  $appOnlyArgs = @{
    Url = $SiteUrl
    ClientId = $ClientId
  }
  Connect-PnPOnline @appOnlyArgs -ClientSecret $ClientSecret
} else {
  Connect-PnPOnline @connectArgs -Interactive
}

$binariesDir = Join-Path $resolvedOutDir "binaries"
if ((Test-Path -LiteralPath $binariesDir) -and $Force) {
  Remove-Item -LiteralPath $binariesDir -Recurse -Force
}

if (-not (Test-Path -LiteralPath $binariesDir)) {
  New-Item -ItemType Directory -Path $binariesDir | Out-Null
}

$manifestFiles = @()
$errors = @()

foreach ($target in $targetLists) {
  $list = $target.List
  $listId = $target.ListId
  $listTitle = [string](Get-ObjectValue -Object $list -Name "Title")

  foreach ($item in $target.FlaggedItems) {
    $itemId = [int](Get-ObjectValue -Object $item -Name "Id")
    try {
      $pnpItem = Get-PnPListItem -List $listId -Id $itemId
      $attachmentFiles = Get-PnPProperty -ClientObject $pnpItem -Property AttachmentFiles

      foreach ($attachment in $attachmentFiles) {
        $fileName = [string](Get-ObjectValue -Object $attachment -Name "FileName")
        $serverRelativeUrl = Convert-ToServerRelativeUrl ([string](Get-ObjectValue -Object $attachment -Name "ServerRelativeUrl"))
        if (-not $fileName -or -not $serverRelativeUrl) {
          continue
        }

        if (-not (Test-ExtensionFilter -FileName $fileName -AllowedExtensions $allowedExtensions)) {
          continue
        }

        $safeFileName = Convert-SafeFileName $fileName
        $itemDir = Join-Path (Join-Path $binariesDir $listId) ([string]$itemId)
        if (-not (Test-Path -LiteralPath $itemDir)) {
          New-Item -ItemType Directory -Path $itemDir -Force | Out-Null
        }

        Get-PnPFile -Url $serverRelativeUrl -Path $itemDir -FileName $safeFileName -AsFile -Force | Out-Null
        $localFile = Join-Path $itemDir $safeFileName
        $fileInfo = Get-Item -LiteralPath $localFile
        $hash = Get-FileHash -LiteralPath $localFile -Algorithm SHA256

        $manifestFiles += [ordered]@{
          source_kind = "list_attachment"
          sharepoint_site_id = if ($site) { [string](Get-ObjectValue -Object $site -Name "Id") } else { "" }
          sharepoint_list_id = $listId
          sharepoint_list_title = $listTitle
          sharepoint_item_id = $itemId
          sharepoint_unique_id = [string](Get-ObjectValue -Object $item -Name "UniqueId")
          sharepoint_etag = [string](Get-ObjectValue -Object $item -Name "ETag")
          file_name = $fileName
          server_relative_url = $serverRelativeUrl
          web_url = ""
          content_type = $null
          file_size = $fileInfo.Length
          sha256 = $hash.Hash.ToLowerInvariant()
          local_path = Get-RelativeExportPath -ExportRoot $resolvedOutDir -Path $localFile
          downloaded_at = (Get-Date).ToUniversalTime().ToString("o")
          raw = [ordered]@{
            attachment = [ordered]@{
              FileName = $fileName
              ServerRelativeUrl = $serverRelativeUrl
            }
          }
        }
      }
    } catch {
      $errors += [ordered]@{
        sharepoint_list_id = $listId
        sharepoint_list_title = $listTitle
        sharepoint_item_id = $itemId
        error = $_.Exception.Message
      }
    }
  }

  foreach ($item in $target.DocumentItems) {
    $itemId = [int](Get-ObjectValue -Object $item -Name "Id")
    $documents = Get-ObjectValue -Object $item -Name "Documents"
    foreach ($document in $documents) {
      $fileName = [string](Get-ObjectValue -Object $document -Name "FileLeafRef")
      $fileRef = Convert-ToServerRelativeUrl ([string](Get-ObjectValue -Object $document -Name "FileRef"))
      if (-not $fileName -or -not $fileRef) {
        continue
      }

      if (-not (Test-ExtensionFilter -FileName $fileName -AllowedExtensions $allowedExtensions)) {
        continue
      }

      try {
        $safeFileName = Convert-SafeFileName $fileName
        $itemDir = Join-Path (Join-Path $binariesDir $listId) ([string]$itemId)
        if (-not (Test-Path -LiteralPath $itemDir)) {
          New-Item -ItemType Directory -Path $itemDir -Force | Out-Null
        }

        Get-PnPFile -Url $fileRef -Path $itemDir -FileName $safeFileName -AsFile -Force | Out-Null
        $localFile = Join-Path $itemDir $safeFileName
        $fileInfo = Get-Item -LiteralPath $localFile
        $hash = Get-FileHash -LiteralPath $localFile -Algorithm SHA256

        $manifestFiles += [ordered]@{
          source_kind = "document_library"
          sharepoint_site_id = if ($site) { [string](Get-ObjectValue -Object $site -Name "Id") } else { "" }
          sharepoint_list_id = $listId
          sharepoint_list_title = $listTitle
          sharepoint_item_id = $itemId
          sharepoint_unique_id = [string](Get-ObjectValue -Object $item -Name "UniqueId")
          sharepoint_etag = [string](Get-ObjectValue -Object $item -Name "ETag")
          file_name = $fileName
          server_relative_url = $fileRef
          web_url = ""
          content_type = [string](Get-ObjectValue -Object $document -Name "ContentType")
          file_size = $fileInfo.Length
          sha256 = $hash.Hash.ToLowerInvariant()
          local_path = Get-RelativeExportPath -ExportRoot $resolvedOutDir -Path $localFile
          downloaded_at = (Get-Date).ToUniversalTime().ToString("o")
          raw = [ordered]@{
            document = [ordered]@{
              FileLeafRef = $fileName
              FileRef = $fileRef
              ContentType = [string](Get-ObjectValue -Object $document -Name "ContentType")
            }
          }
        }
      } catch {
        $errors += [ordered]@{
          sharepoint_list_id = $listId
          sharepoint_list_title = $listTitle
          sharepoint_item_id = $itemId
          file_name = $fileName
          error = $_.Exception.Message
        }
      }
    }
  }
}

$manifest = [ordered]@{
  generated_at = (Get-Date).ToUniversalTime().ToString("o")
  site = $site
  source = "sharepoint_download_binaries.ps1"
  summary = $summary
  files = $manifestFiles
  errors = $errors
}

$manifestPath = Join-Path $binariesDir "manifest.json"
$manifest | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Host ("Downloaded binary files: {0}" -f $manifestFiles.Count)
Write-Host ("Download errors: {0}" -f $errors.Count)
Write-Host "Manifest: $manifestPath"
