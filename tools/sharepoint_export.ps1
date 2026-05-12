param(
  [string]$SiteUrl = $env:SHAREPOINT_SITE_URL,
  [string]$OutDir = $(if ($env:SHAREPOINT_EXPORT_DIR) { $env:SHAREPOINT_EXPORT_DIR } else { ".sharepoint-export" }),
  [string]$ClientId = $env:ENTRAID_CLIENT_ID,
  [string]$ClientSecret = $(if ($env:M365_CLIENT_SECRET) { $env:M365_CLIENT_SECRET } else { "" }),
  [string]$Tenant = $(if ($env:ENTRAID_TENANT_ID) { $env:ENTRAID_TENANT_ID } elseif ($env:ENTRAID_TENANT) { $env:ENTRAID_TENANT } elseif ($env:SHAREPOINT_TENANT) { $env:SHAREPOINT_TENANT } else { "" }),
  [string]$EnvFile = $env:M365_ENV_FILE,
  [ValidateSet("Interactive", "DeviceLogin", "OSLogin", "AppOnly")]
  [string]$AuthMode = "Interactive",
  [int]$PageSize = 5000,
  [switch]$IncludeHidden,
  [switch]$SkipItems,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

function Import-DotEnv {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
      $key, $value = $line.Split("=", 2)
      $key = $key.Trim()
      $value = $value.Trim().Trim('"').Trim("'")

      if ($key -and -not [Environment]::GetEnvironmentVariable($key, "Process")) {
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
      }
    }
  }
}

function Convert-GuidText {
  param($Value)

  if ($null -eq $Value) {
    return $null
  }

  $text = [string]$Value
  if (-not $text) {
    return $null
  }

  return $text.Trim("{", "}").ToLowerInvariant()
}

function Get-ObjectValue {
  param(
    $Object,
    [string]$Name
  )

  if ($null -eq $Object) {
    return $null
  }

  try {
    return $Object.$Name
  } catch {
    return $null
  }
}

function Convert-SharePointValue {
  param(
    $Value,
    [int]$Depth = 0
  )

  if ($null -eq $Value) {
    return $null
  }

  if ($Depth -gt 5) {
    return [string]$Value
  }

  if ($Value -is [string] -or $Value -is [bool] -or $Value -is [int] -or $Value -is [long] -or $Value -is [double] -or $Value -is [decimal]) {
    return $Value
  }

  if ($Value -is [datetime]) {
    return $Value.ToUniversalTime().ToString("o")
  }

  if ($Value -is [System.Collections.IDictionary]) {
    $result = [ordered]@{}
    foreach ($key in $Value.Keys) {
      $result[[string]$key] = Convert-SharePointValue -Value $Value[$key] -Depth ($Depth + 1)
    }
    return $result
  }

  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    $items = @()
    foreach ($item in $Value) {
      $items += Convert-SharePointValue -Value $item -Depth ($Depth + 1)
    }
    return $items
  }

  $knownProps = @(
    "LookupId",
    "LookupValue",
    "Email",
    "SipAddress",
    "TermGuid",
    "Label",
    "WssId",
    "Url",
    "Description"
  )

  $result = [ordered]@{}
  foreach ($prop in $knownProps) {
    $propValue = Get-ObjectValue -Object $Value -Name $prop
    if ($null -ne $propValue) {
      $result[$prop] = Convert-SharePointValue -Value $propValue -Depth ($Depth + 1)
    }
  }

  if ($result.Count -gt 0) {
    return $result
  }

  return [string]$Value
}

function Convert-Field {
  param($Field)

  $choices = @()
  $rawChoices = Get-ObjectValue -Object $Field -Name "Choices"
  if ($rawChoices) {
    foreach ($choice in $rawChoices) {
      $choices += [string]$choice
    }
  }

  return [ordered]@{
    Id = Convert-GuidText (Get-ObjectValue -Object $Field -Name "Id")
    InternalName = [string](Get-ObjectValue -Object $Field -Name "InternalName")
    StaticName = [string](Get-ObjectValue -Object $Field -Name "StaticName")
    Title = [string](Get-ObjectValue -Object $Field -Name "Title")
    TypeAsString = [string](Get-ObjectValue -Object $Field -Name "TypeAsString")
    TypeDisplayName = [string](Get-ObjectValue -Object $Field -Name "TypeDisplayName")
    Required = [bool](Get-ObjectValue -Object $Field -Name "Required")
    Hidden = [bool](Get-ObjectValue -Object $Field -Name "Hidden")
    ReadOnlyField = [bool](Get-ObjectValue -Object $Field -Name "ReadOnlyField")
    Indexed = [bool](Get-ObjectValue -Object $Field -Name "Indexed")
    EnforceUniqueValues = [bool](Get-ObjectValue -Object $Field -Name "EnforceUniqueValues")
    AllowMultipleValues = [bool](Get-ObjectValue -Object $Field -Name "AllowMultipleValues")
    LookupList = Convert-GuidText (Get-ObjectValue -Object $Field -Name "LookupList")
    LookupField = [string](Get-ObjectValue -Object $Field -Name "LookupField")
    DefaultValue = [string](Get-ObjectValue -Object $Field -Name "DefaultValue")
    Description = [string](Get-ObjectValue -Object $Field -Name "Description")
    Group = [string](Get-ObjectValue -Object $Field -Name "Group")
    Choices = $choices
    SchemaXml = [string](Get-ObjectValue -Object $Field -Name "SchemaXml")
  }
}

function Convert-List {
  param($List)

  return [ordered]@{
    Id = Convert-GuidText (Get-ObjectValue -Object $List -Name "Id")
    Title = [string](Get-ObjectValue -Object $List -Name "Title")
    EntityTypeName = [string](Get-ObjectValue -Object $List -Name "EntityTypeName")
    Hidden = [bool](Get-ObjectValue -Object $List -Name "Hidden")
    BaseTemplate = [int](Get-ObjectValue -Object $List -Name "BaseTemplate")
    BaseType = [string](Get-ObjectValue -Object $List -Name "BaseType")
    ItemCount = [int](Get-ObjectValue -Object $List -Name "ItemCount")
    EnableAttachments = [bool](Get-ObjectValue -Object $List -Name "EnableAttachments")
    Created = Convert-SharePointValue (Get-ObjectValue -Object $List -Name "Created")
    LastItemModifiedDate = Convert-SharePointValue (Get-ObjectValue -Object $List -Name "LastItemModifiedDate")
    DefaultViewUrl = [string](Get-ObjectValue -Object $List -Name "DefaultViewUrl")
    RootFolderServerRelativeUrl = [string](Get-ObjectValue -Object (Get-ObjectValue -Object $List -Name "RootFolder") -Name "ServerRelativeUrl")
  }
}

function Convert-ListItem {
  param(
    $Item,
    $List
  )

  $values = [ordered]@{}
  foreach ($key in $Item.FieldValues.Keys) {
    $values[[string]$key] = Convert-SharePointValue -Value $Item.FieldValues[$key]
  }

  $attachments = @()
  if ([bool](Get-ObjectValue -Object $List -Name "EnableAttachments")) {
    try {
      $attachmentFiles = Get-PnPProperty -ClientObject $Item -Property AttachmentFiles
      foreach ($attachment in $attachmentFiles) {
        $attachments += [ordered]@{
          FileName = [string](Get-ObjectValue -Object $attachment -Name "FileName")
          ServerRelativeUrl = [string](Get-ObjectValue -Object $attachment -Name "ServerRelativeUrl")
        }
      }
    } catch {
      $attachments += [ordered]@{
        ExportError = $_.Exception.Message
      }
    }
  }

  $documents = @()
  if ([string](Get-ObjectValue -Object $List -Name "BaseType") -eq "DocumentLibrary") {
    $documents += [ordered]@{
      FileRef = $values["FileRef"]
      FileLeafRef = $values["FileLeafRef"]
      FileDirRef = $values["FileDirRef"]
      FileSizeDisplay = $values["File_x0020_Size"]
      ContentType = $values["ContentType"]
      FSObjType = $values["FSObjType"]
    }
  }

  return [ordered]@{
    Id = [int]$Item.Id
    UniqueId = [string]$values["GUID"]
    ETag = [string]$values["_UIVersionString"]
    Modified = $values["Modified"]
    Values = $values
    Attachments = $attachments
    Documents = $documents
  }
}

Import-DotEnv -Path ".env.local"

if ($EnvFile) {
  Import-DotEnv -Path $EnvFile
}

if (-not $SiteUrl) {
  $SiteUrl = $env:SHAREPOINT_SITE_URL
}

if (-not $OutDir) {
  $OutDir = if ($env:SHAREPOINT_EXPORT_DIR) { $env:SHAREPOINT_EXPORT_DIR } else { ".sharepoint-export" }
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
  $Tenant = $env:ENTRAID_TENANT
}

if (-not $Tenant) {
  $Tenant = $env:SHAREPOINT_TENANT
}

if ((-not $Tenant) -or $AuthMode -eq "AppOnly") {
  if ($env:M365_TENANT_ID) {
    $Tenant = $env:M365_TENANT_ID
  }
}

if (-not $Tenant) {
  try {
    $hostName = ([Uri]$SiteUrl).Host
    if ($hostName -match "^([^.]+)\.sharepoint\.com$") {
      $Tenant = "$($Matches[1]).onmicrosoft.com"
    }
  } catch {
    $Tenant = ""
  }
}

if (-not $SiteUrl) {
  throw "Missing SHAREPOINT_SITE_URL. Set it in .env.local or pass -SiteUrl."
}

if (-not $ClientId) {
  throw "Missing ENTRAID_CLIENT_ID. Create or reuse an Entra app registration for PnP login and set it in .env.local."
}

if ($AuthMode -eq "AppOnly" -and -not $ClientSecret) {
  throw "Missing M365_CLIENT_SECRET. Set it in m365.env or pass -ClientSecret."
}

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
  throw "PnP.PowerShell is not installed. Install-Module PnP.PowerShell -Scope CurrentUser"
}

$resolvedOutDir = Resolve-Path -LiteralPath "." | Select-Object -ExpandProperty Path
$resolvedOutDir = Join-Path $resolvedOutDir $OutDir

if ((Test-Path -LiteralPath $resolvedOutDir) -and -not $Force) {
  throw "Export directory already exists: $resolvedOutDir. Use -Force to overwrite."
}

if (Test-Path -LiteralPath $resolvedOutDir) {
  Remove-Item -LiteralPath $resolvedOutDir -Recurse -Force
}

New-Item -ItemType Directory -Path $resolvedOutDir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $resolvedOutDir "fields") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $resolvedOutDir "items") | Out-Null

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
  Connect-PnPOnline @connectArgs -ClientSecret $ClientSecret
} else {
  Connect-PnPOnline @connectArgs -Interactive
}

$web = Get-PnPWeb -Includes Id, Title, Url
$site = [ordered]@{
  Id = Convert-GuidText (Get-ObjectValue -Object $web -Name "Id")
  Title = [string](Get-ObjectValue -Object $web -Name "Title")
  Url = [string](Get-ObjectValue -Object $web -Name "Url")
  ExportedAt = (Get-Date).ToUniversalTime().ToString("o")
}

$site | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $resolvedOutDir "site.json") -Encoding UTF8

$rawLists = Get-PnPList -Includes Id, Title, Hidden, BaseTemplate, BaseType, ItemCount, EnableAttachments, Created, LastItemModifiedDate, EntityTypeName, DefaultViewUrl, RootFolder
$lists = @()
$summary = @()

foreach ($list in $rawLists) {
  if (-not $IncludeHidden -and [bool](Get-ObjectValue -Object $list -Name "Hidden")) {
    continue
  }

  $baseType = [string](Get-ObjectValue -Object $list -Name "BaseType")
  if ($baseType -notin @("GenericList", "DocumentLibrary")) {
    continue
  }

  $listInfo = Convert-List -List $list
  $lists += $listInfo

  $listId = $listInfo.Id
  Write-Host "Exporting $($listInfo.Title) [$listId]"

  $fields = Get-PnPField -List $list -Includes Id, InternalName, StaticName, Title, TypeAsString, TypeDisplayName, Required, Hidden, ReadOnlyField, Indexed, EnforceUniqueValues, AllowMultipleValues, LookupList, LookupField, DefaultValue, Description, Group, Choices, SchemaXml
  $fieldInfo = @()
  foreach ($field in $fields) {
    $fieldInfo += Convert-Field -Field $field
  }

  $fieldInfo | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $resolvedOutDir "fields/$listId.json") -Encoding UTF8

  $itemCount = 0
  if (-not $SkipItems) {
    $fieldNames = @()
    foreach ($field in $fieldInfo) {
      if (-not $field["Hidden"] -or $field["InternalName"] -in @("ID", "GUID", "Modified", "Created", "Editor", "Author", "FileRef", "FileLeafRef", "FileDirRef", "File_x0020_Size", "ContentType", "FSObjType", "_UIVersionString")) {
        $fieldNames += $field["InternalName"]
      }
    }

    $items = @()
    $listItems = Get-PnPListItem -List $list -PageSize $PageSize -Fields $fieldNames
    foreach ($item in $listItems) {
      $items += Convert-ListItem -Item $item -List $list
      $itemCount += 1
    }

    $items | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath (Join-Path $resolvedOutDir "items/$listId.json") -Encoding UTF8
  }

  $summary += [ordered]@{
    ListId = $listInfo.Id
    Title = $listInfo.Title
    BaseType = $listInfo.BaseType
    FieldCount = $fieldInfo.Count
    ExportedItemCount = $itemCount
  }
}

$lists | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $resolvedOutDir "lists.json") -Encoding UTF8

[ordered]@{
  Site = $site
  IncludeHidden = [bool]$IncludeHidden
  SkipItems = [bool]$SkipItems
  PageSize = $PageSize
  Lists = $summary
} | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $resolvedOutDir "export-summary.json") -Encoding UTF8

Write-Host "SharePoint export complete: $resolvedOutDir"
