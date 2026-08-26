[CmdletBinding()]
param(
  [string]$WallpaperEngineRoot = "C:\Program Files (x86)\Steam\steamapps\common\wallpaper_engine",
  [string]$WorkshopRoot = "C:\Program Files (x86)\Steam\steamapps\workshop\content\431960",
  [ValidateRange(4, 60)]
  [int]$CaptureSeconds = 10,
  [ValidateRange(24, 60)]
  [int]$FrameRate = 30,
  [switch]$Force,
  [switch]$SkipWorkshop,
  [switch]$NoVisibleCapture
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$neoRoot = Join-Path $repoRoot "neo-os"
$outputRoot = Join-Path $neoRoot "assets\wallpaper-engine-full"
$webOutputRoot = Join-Path $neoRoot "assets\wallpaper-engine-web"
$baseManifestPath = Join-Path $neoRoot "wallpaper-engine-projects.json"
$fullManifestPath = Join-Path $neoRoot "wallpaper-full-media.json"
$engineExe = Join-Path $WallpaperEngineRoot "wallpaper64.exe"
$defaultProjectRoot = Join-Path $WallpaperEngineRoot "projects\defaultprojects"
$skipWorkshopIds = @("3719119251") # Long-form movie content is not a wallpaper loop.
$blockedCaptureIds = @(
  "we-arsenal",
  "we-audiophile",
  "we-beach",
  "we-corsair_collection",
  "we-corsair_o_tron",
  "we-deep_space",
  "we-demon_core",
  "we-dino_run",
  "we-dna_fragment",
  "we-fantasticcar",
  "we-neon_sunset"
) # Previous display-wide renders exposed desktop or gameplay footage.

function Resolve-Tool([string]$Name) {
  $command = Get-Command "$Name.exe" -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $candidate = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter "$Name.exe" -File -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
  if ($candidate) { return $candidate }
  throw "$Name is required. Install Gyan.FFmpeg from WinGet before running this script."
}

function Assert-PathInside([string]$Candidate, [string]$Parent) {
  $resolvedCandidate = [IO.Path]::GetFullPath($Candidate)
  $resolvedParent = [IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
  if (-not $resolvedCandidate.StartsWith($resolvedParent, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to write outside the wallpaper output folder: $resolvedCandidate"
  }
}

function Get-RelativeFilePath([string]$Candidate, [string]$Parent) {
  $resolvedCandidate = [IO.Path]::GetFullPath($Candidate)
  $resolvedParent = [IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
  if (-not $resolvedCandidate.StartsWith($resolvedParent, [StringComparison]::OrdinalIgnoreCase)) {
    throw "The file leaves its expected parent folder: $resolvedCandidate"
  }
  return $resolvedCandidate.Substring($resolvedParent.Length)
}

function Get-SafeSlug([string]$Value) {
  $slug = ($Value.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')
  if (-not $slug) { $slug = "wallpaper" }
  return $slug.Substring(0, [Math]::Min(72, $slug.Length))
}

function Get-JsonValue([object]$Object, [string]$Name, $Fallback = $null) {
  if ($null -eq $Object) { return $Fallback }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property -or $null -eq $property.Value) { return $Fallback }
  return $property.Value
}

function Get-VideoInfo([string]$Path) {
  $source = & $script:ffprobe -v error -select_streams v:0 `
    -show_entries stream=codec_name,width,height,r_frame_rate,duration `
    -of json -- $Path
  if ($LASTEXITCODE -ne 0) { throw "Could not inspect $Path" }
  $parsed = $source | ConvertFrom-Json
  if (-not $parsed.streams -or $parsed.streams.Count -eq 0) { throw "No video stream in $Path" }
  return $parsed.streams[0]
}

function Test-VideoMotion([string]$Path) {
  $hashes = & $script:ffmpeg -hide_banner -loglevel error -i $Path -vf "fps=2" -t 4 -f framemd5 - |
    Where-Object { $_ -match '^0,' } |
    ForEach-Object { ($_ -split ',')[-1].Trim() } |
    Select-Object -Unique
  return @($hashes).Count -gt 1
}

function New-Poster([string]$VideoPath, [string]$PosterPath) {
  Assert-PathInside $PosterPath $outputRoot
  & $script:ffmpeg -hide_banner -loglevel error -ss 1 -i $VideoPath -frames:v 1 `
    -vf "scale=480:270:force_original_aspect_ratio=increase:flags=lanczos,crop=480:270" `
    -c:v libwebp -quality 88 -y $PosterPath
  if ($LASTEXITCODE -ne 0) { throw "Could not make a poster for $VideoPath" }
}

if (-not (Test-Path -LiteralPath $engineExe)) { throw "Wallpaper Engine was not found at $engineExe" }
if (-not (Test-Path -LiteralPath $baseManifestPath)) { throw "Missing $baseManifestPath" }
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
New-Item -ItemType Directory -Force -Path $webOutputRoot | Out-Null

$script:ffmpeg = Resolve-Tool "ffmpeg"
$script:ffprobe = Resolve-Tool "ffprobe"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class NeoWallpaperCaptureWindow {
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int index);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int index, int value);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int width, int height, uint flags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int command);
}
"@

function Get-CaptureWindow([string]$Title) {
  for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
    $process = Get-Process wallpaper64 -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowTitle -eq $Title } |
      Select-Object -First 1
    if ($process -and $process.MainWindowHandle -ne 0) { return $process.MainWindowHandle }
    Start-Sleep -Milliseconds 250
  }
  throw "Wallpaper Engine did not open the capture window: $Title"
}

function Show-CaptureWindow([IntPtr]$Handle) {
  $style = [NeoWallpaperCaptureWindow]::GetWindowLong($Handle, -16)
  $style = ($style -band (-bnot 0x00CC0000)) -bor 0x80000000 -bor 0x10000000
  [void][NeoWallpaperCaptureWindow]::SetWindowLong($Handle, -16, $style)
  [void][NeoWallpaperCaptureWindow]::ShowWindow($Handle, 9)
  [void][NeoWallpaperCaptureWindow]::SetWindowPos($Handle, [IntPtr](-1), 0, 0, 1920, 1080, 0x40)
  [void][NeoWallpaperCaptureWindow]::SetForegroundWindow($Handle)
}

function Capture-Project([string]$ProjectPath, [string]$OutputPath, [string]$Identity) {
  throw "Visible rendering is disabled because display-wide capture can expose desktop or gameplay footage. Import native video media or use a verified background render."
}

function Import-Video([string]$SourcePath, [string]$OutputPath, [string]$Identity) {
  Assert-PathInside $OutputPath $outputRoot
  if ((Test-Path -LiteralPath $OutputPath) -and -not $Force) {
    $existing = Get-VideoInfo $OutputPath
    if ($existing.width -ge 1920 -and $existing.height -ge 1080 -and (Test-VideoMotion $OutputPath)) {
      return $existing
    }
  }

  $sourceInfo = Get-VideoInfo $SourcePath
  $temporaryPath = "$OutputPath.building.mp4"
  Assert-PathInside $temporaryPath $outputRoot
  Write-Host "Importing $Identity..." -ForegroundColor Cyan

  if ($sourceInfo.codec_name -eq "h264" -and $sourceInfo.width -ge 1920 -and $sourceInfo.height -ge 1080) {
    Copy-Item -LiteralPath $SourcePath -Destination $temporaryPath -Force
  } else {
    & $script:ffmpeg -hide_banner -loglevel warning -i $SourcePath -an `
      -vf "scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080" `
      -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -g ($FrameRate * 2) `
      -movflags +faststart -y $temporaryPath
    if ($LASTEXITCODE -ne 0) { throw "FFmpeg could not import $Identity" }
  }

  $info = Get-VideoInfo $temporaryPath
  if ($info.width -lt 1920 -or $info.height -lt 1080) { throw "$Identity is below 1080p after import." }
  if (-not (Test-VideoMotion $temporaryPath)) { throw "$Identity is static and was rejected." }
  Move-Item -LiteralPath $temporaryPath -Destination $OutputPath -Force
  return Get-VideoInfo $OutputPath
}

function Import-WebProject(
  [string]$SourceRoot,
  [string]$EntryFile,
  [string]$PreviewFile,
  [string]$Identity
) {
  $resolvedSource = [IO.Path]::GetFullPath($SourceRoot).TrimEnd('\') + '\'
  $entryPath = [IO.Path]::GetFullPath((Join-Path $SourceRoot $EntryFile))
  if (-not $entryPath.StartsWith($resolvedSource, [StringComparison]::OrdinalIgnoreCase)) {
    throw "The web wallpaper entry leaves its project folder."
  }
  if (-not (Test-Path -LiteralPath $entryPath -PathType Leaf) -or [IO.Path]::GetExtension($entryPath) -notin @(".html", ".htm")) {
    throw "The declared web wallpaper entry is missing or unsupported."
  }

  $files = @(Get-ChildItem -LiteralPath $SourceRoot -Recurse -File -Force | Where-Object { -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) })
  $blockedExtensions = @(".exe", ".dll", ".msi", ".bat", ".cmd", ".ps1", ".com", ".scr", ".jar")
  $blocked = @($files | Where-Object { $blockedExtensions -contains $_.Extension.ToLowerInvariant() })
  if ($blocked.Count) { throw "The web wallpaper package contains executable files and was rejected." }
  $totalBytes = [long](($files | Measure-Object Length -Sum).Sum)
  if ($totalBytes -le 0 -or $totalBytes -gt 220MB) { throw "The web wallpaper package is empty or exceeds the 220 MB browser package limit." }

  $destinationRoot = Join-Path $webOutputRoot $Identity
  Assert-PathInside $destinationRoot $webOutputRoot
  New-Item -ItemType Directory -Force -Path $destinationRoot | Out-Null
  foreach ($file in $files) {
    $relative = Get-RelativeFilePath $file.FullName $SourceRoot
    $destination = Join-Path $destinationRoot $relative
    Assert-PathInside $destination $destinationRoot
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
  }

  $resolvedPreview = ""
  if ($PreviewFile) {
    $candidate = [IO.Path]::GetFullPath((Join-Path $SourceRoot $PreviewFile))
    if ($candidate.StartsWith($resolvedSource, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      $resolvedPreview = Get-RelativeFilePath $candidate $SourceRoot
    }
  }
  if (-not $resolvedPreview) {
    $fallback = $files | Where-Object { $_.Name -match '^preview\.(gif|webp|png|jpe?g)$' } | Select-Object -First 1
    if ($fallback) { $resolvedPreview = Get-RelativeFilePath $fallback.FullName $SourceRoot }
  }
  if (-not $resolvedPreview) { throw "The web wallpaper has no local preview image." }

  return [ordered]@{
    entry = (Get-RelativeFilePath $entryPath $SourceRoot).Replace('\', '/')
    preview = $resolvedPreview.Replace('\', '/')
    bytes = $totalBytes
  }
}

function New-FullMediaRecord(
  [string]$Id,
  [string]$Name,
  [string]$SourceType,
  [string]$OutputPath,
  [object]$Info,
  [string]$Quality,
  [string]$SourceId = ""
) {
  $posterName = [IO.Path]::GetFileNameWithoutExtension($OutputPath) + "-poster.webp"
  $posterPath = Join-Path $outputRoot $posterName
  New-Poster $OutputPath $posterPath
  $relativeFile = "./assets/wallpaper-engine-full/" + [IO.Path]::GetFileName($OutputPath)
  $relativePoster = "./assets/wallpaper-engine-full/" + $posterName
  $record = [ordered]@{
    id = $Id
    title = $Name
    type = $SourceType
    mediaType = "video"
    file = $relativeFile
    preview = $relativePoster
    width = [int]$Info.width
    height = [int]$Info.height
    fps = [string]$Info.r_frame_rate
    duration = [Math]::Round([double]$Info.duration, 2)
    bytes = (Get-Item -LiteralPath $OutputPath).Length
    quality = $Quality
    localOnly = $true
  }
  if ($SourceId) { $record.sourceId = $SourceId }
  return $record
}

function New-WebMediaRecord(
  [string]$Id,
  [string]$Name,
  [string]$SourceId,
  [object]$WebProject
) {
  return [ordered]@{
    id = $Id
    title = $Name
    type = "web"
    mediaType = "web"
    file = "./assets/wallpaper-engine-web/$SourceId/$($WebProject.entry)"
    preview = "./assets/wallpaper-engine-web/$SourceId/$($WebProject.preview)"
    width = 1920
    height = 1080
    responsive = $true
    bytes = [long]$WebProject.bytes
    quality = "original-web"
    localOnly = $true
    sourceId = $SourceId
  }
}

$results = [Collections.Generic.List[object]]::new()
$failures = [Collections.Generic.List[object]]::new()
$baseManifest = Get-Content -LiteralPath $baseManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

foreach ($project in $baseManifest.projects) {
  if ($blockedCaptureIds -contains [string]$project.id) {
    $failures.Add([ordered]@{
      id = $project.id
      title = $project.title
      reason = "Rejected because the prior render contained desktop or gameplay footage."
    })
    continue
  }
  $projectPath = Join-Path (Join-Path $defaultProjectRoot $project.sourceFolder) "project.json"
  $slug = Get-SafeSlug $project.id
  $outputPath = Join-Path $outputRoot "$slug.mp4"
  try {
    if (-not (Test-Path -LiteralPath $projectPath)) { throw "Source project is missing." }
    if ($NoVisibleCapture) {
      if (-not (Test-Path -LiteralPath $outputPath)) { throw "A full render is not available in background-only mode." }
      $info = Get-VideoInfo $outputPath
      if ($info.width -lt 1920 -or $info.height -lt 1080 -or -not (Test-VideoMotion $outputPath)) {
        throw "The existing render is not a moving 1080p wallpaper."
      }
    } else {
      $info = Capture-Project $projectPath $outputPath $slug
    }
    $results.Add((New-FullMediaRecord $project.id $project.title $project.type $outputPath $info "rendered-1080p"))
  } catch {
    $failures.Add([ordered]@{ id = $project.id; title = $project.title; reason = $_.Exception.Message })
    Write-Warning "$($project.title): $($_.Exception.Message)"
  }
}

if (-not $SkipWorkshop -and (Test-Path -LiteralPath $WorkshopRoot)) {
  foreach ($folder in Get-ChildItem -LiteralPath $WorkshopRoot -Directory | Sort-Object Name) {
    if ($skipWorkshopIds -contains $folder.Name) { continue }
    $projectPath = Join-Path $folder.FullName "project.json"
    if (-not (Test-Path -LiteralPath $projectPath)) { continue }
    try {
      $project = Get-Content -LiteralPath $projectPath -Raw -Encoding UTF8 | ConvertFrom-Json
      $sourceType = [string](Get-JsonValue $project "type" "")
      if (-not $sourceType) { $sourceType = "unknown" }
      $sourceType = $sourceType.ToLowerInvariant()
      $id = "we-steam-$($folder.Name)"
      $title = [string](Get-JsonValue $project "title" "")
      if (-not $title) { $title = "Workshop $($folder.Name)" }
      $slug = Get-SafeSlug $id
      $outputPath = Join-Path $outputRoot "$slug.mp4"

      $declaredFile = [string](Get-JsonValue $project "file" "")

      if ($sourceType -eq "video" -and $declaredFile) {
        $sourcePath = Join-Path $folder.FullName $declaredFile
        if (-not (Test-Path -LiteralPath $sourcePath)) { throw "Declared video source is missing." }
        $info = Import-Video $sourcePath $outputPath $slug
        $quality = if ($info.width -gt 1920 -or $info.height -gt 1080) { "native-4k" } else { "native-1080p" }
      } elseif ($sourceType -eq "web" -and $declaredFile) {
        $declaredPreview = [string](Get-JsonValue $project "preview" "")
        $webProject = Import-WebProject $folder.FullName $declaredFile $declaredPreview $folder.Name
        $results.Add((New-WebMediaRecord $id $title $folder.Name $webProject))
        continue
      } elseif ($sourceType -eq "scene") {
        if ($NoVisibleCapture) {
          if (-not (Test-Path -LiteralPath $outputPath)) { throw "A full render is not available in background-only mode." }
          $info = Get-VideoInfo $outputPath
          if ($info.width -lt 1920 -or $info.height -lt 1080 -or -not (Test-VideoMotion $outputPath)) {
            throw "The existing render is not a moving 1080p wallpaper."
          }
        } else {
          $info = Capture-Project $projectPath $outputPath $slug
        }
        $quality = "rendered-1080p"
      } else {
        throw "Unsupported source type '$sourceType'."
      }

      $results.Add((New-FullMediaRecord $id $title $sourceType $outputPath $info $quality $folder.Name))
    } catch {
      $failures.Add([ordered]@{ id = "we-steam-$($folder.Name)"; title = $folder.Name; reason = $_.Exception.Message })
      Write-Warning "Workshop $($folder.Name): $($_.Exception.Message)"
    }
  }
}

$manifest = [ordered]@{
  version = 1
  generatedAt = [DateTime]::UtcNow.ToString("o")
  minimumResolution = "1920x1080"
  projects = @($results)
  rejected = @($failures)
}
$json = $manifest | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($fullManifestPath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "Full-media wallpapers: $($results.Count)" -ForegroundColor Green
Write-Host "Rejected or unsupported: $($failures.Count)" -ForegroundColor Yellow
Write-Host "Manifest: $fullManifestPath"
