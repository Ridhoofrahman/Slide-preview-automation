# Slideshot installer for PowerPoint on Windows. No admin rights, no shared folder. Run in PowerShell:
#   irm https://ridhoofrahman.github.io/Slide-preview-automation/slide-qa-marker/install/install-windows.ps1 | iex
# Downloads the latest manifest, registers it for this Windows user (the same registry key Microsoft's
# sideloading tools use), clears Office's add-in cache and reopens PowerPoint. Run it again any time to update.
$ErrorActionPreference = 'Stop'
$manifestUrl = if ($env:SLIDESHOT_MANIFEST_URL) { $env:SLIDESHOT_MANIFEST_URL } else { 'https://ridhoofrahman.github.io/Slide-preview-automation/slide-qa-marker/manifest.xml' }
$dir  = Join-Path $env:LOCALAPPDATA 'Slideshot'
$path = Join-Path $dir 'slideshot.xml'

# PowerPoint only reads add-ins when it starts, so close it first (it asks to save open files)
$ppt = Get-Process POWERPNT -ErrorAction SilentlyContinue
if ($ppt) {
  Write-Host 'Closing PowerPoint. Save your files if it asks...'
  $ppt | ForEach-Object { [void]$_.CloseMainWindow() }
  $ppt | Wait-Process -Timeout 90 -ErrorAction SilentlyContinue
  if (Get-Process POWERPNT -ErrorAction SilentlyContinue) { Write-Host 'PowerPoint is still open. Close it and run this again.'; return }
}

New-Item -ItemType Directory -Force -Path $dir | Out-Null
$tmp = "$path.download"
try {
  Invoke-WebRequest -UseBasicParsing -Uri ($manifestUrl + '?v=' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) -OutFile $tmp
} catch { Write-Host 'Could not download Slideshot. Check your internet connection and try again.'; return }
[xml]$m = Get-Content -Raw -Path $tmp
$id = $m.OfficeApp.Id
$version = $m.OfficeApp.Version
if (-not $id) { Remove-Item $tmp -Force; Write-Host 'The downloaded file is not a Slideshot manifest. Nothing was changed.'; return }
Move-Item -Force $tmp $path

# Register for this user: name = add-in Id, data = path to the manifest
$key = 'HKCU:\Software\Microsoft\Office\16.0\WEF\Developer'
if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
Set-ItemProperty -Path $key -Name $id -Value $path

# Clear Office's add-in cache so the new manifest is used (same as Microsoft's "Clear the Office cache")
$cache = Join-Path $env:LOCALAPPDATA 'Microsoft\Office\16.0\Wef'
if (Test-Path $cache) { Get-ChildItem -Path $cache -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }

Write-Host "Slideshot $version is installed."
Write-Host 'In PowerPoint: Insert > My Add-ins (or Home > Add-ins) > Developer Add-ins > Slideshot.'
Start-Process POWERPNT -ErrorAction SilentlyContinue
