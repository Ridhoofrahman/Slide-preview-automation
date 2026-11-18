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
1. Open file A → Compile Lab → select some slides in the thumbnail list (Cmd/Ctrl-click) → **Send selected slides**.
2. Open file B → Compile Lab → select other slides → **Send selected slides**. They join the same pool.
3. Check the pool: order (change it with ↑ ↓), remove slides with ✕, open one slide as its own file with ↗.
4. Open the file that should receive the slides (or a new blank one) → Compile Lab → **Compile**. Slides are added at the end, in pool order.
5. Compare the result with the originals: order, fonts, layouts, images, charts, animations, speaker notes.
6. Sending the same slide again replaces the older version in the pool.

## Notes
- Splitting needs PowerPointApi 1.8 (recent Microsoft 365). The footer shows if it's supported.
- The pool lives inside the add-in on this computer only (IndexedDB), shared by every file you open here. Nothing is uploaded yet.
- Save files before sending, so the pool shows their file names.
- Try both "Slide look" options and note which one keeps the design intact.
