# Compile Lab (prototype)

Separate test add-in. It does not touch Slideshot (own ID, own button "Compile Lab").

## 1. Put it online
Copy this folder into the repo as `slide-qa-marker/lab/compile/` and push.
After ~1 minute it is live at
https://ridhoofrahman.github.io/Slide-preview-automation/slide-qa-marker/lab/compile/taskpane.html

## 2. Install
**Mac** (Terminal):
```
mkdir -p ~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef && curl -fsSL https://ridhoofrahman.github.io/Slide-preview-automation/slide-qa-marker/lab/compile/manifest.xml -o ~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef/compile-lab.xml
```
Quit PowerPoint (Cmd+Q), open it, then Home → Add-ins → Compile Lab.

**Windows** (PowerShell, no admin):
```
$d="$env:LOCALAPPDATA\CompileLab"; New-Item -ItemType Directory -Force $d | Out-Null; Invoke-WebRequest https://ridhoofrahman.github.io/Slide-preview-automation/slide-qa-marker/lab/compile/manifest.xml -OutFile "$d\compile-lab.xml"; New-Item -Path "HKCU:\Software\Microsoft\Office\16.0\WEF\Developer" -Force | Out-Null; Set-ItemProperty -Path "HKCU:\Software\Microsoft\Office\16.0\WEF\Developer" -Name "692f0c9c-69c2-4b13-bddc-494439c729d9" -Value "$d\compile-lab.xml"
```
Close PowerPoint completely, open it, then Home → Add-ins → Compile Lab.

## 3. Test
1. Open a deck → Compile Lab → **Split into files**. Each slide appears as `slide-01.pptx`, `slide-02.pptx`, …
2. Click **Open** on a file to see it as its own presentation.
3. (Optional) **Mix up order** to simulate parts arriving out of order.
4. File → New blank presentation → open Compile Lab there → **Compile**.
5. Compare the result with the original: order, fonts, layouts, images, charts, animations, speaker notes.

## Notes
- Splitting needs PowerPointApi 1.8 (recent Microsoft 365). The footer shows if it's supported.
- Files are stored inside the add-in on this computer only (IndexedDB). Nothing is uploaded.
- Try both "Slide look" options and note which one keeps the design intact.
