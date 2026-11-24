# Compile Lab (prototype v0.2)

Separate test add-in. It does not touch Slideshot (own ID, own button "Compile Lab").

New in v0.2: a **starter file** that opens Compile Lab by itself, compiles the pool after a
3-second countdown, and reads the finished file back (the file that would be saved to the order folder).

## 1. Put it online
Copy this folder's files into the repo as `slide-qa-marker/lab/compile/` and push.
Live at https://ridhoofrahman.github.io/Slide-preview-automation/slide-qa-marker/lab/compile/taskpane.html

## 2. Install (again, because the manifest changed in v0.2)
**Mac** (Terminal):
```
mkdir -p ~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef && curl -fsSL https://ridhoofrahman.github.io/Slide-preview-automation/slide-qa-marker/lab/compile/manifest.xml -o ~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef/compile-lab.xml
```
Quit PowerPoint (Cmd+Q) and open it again. The panel footer should say **v0.2**.

**Windows** (PowerShell, no admin). First time:
```
$d="$env:LOCALAPPDATA\CompileLab"; New-Item -ItemType Directory -Force $d | Out-Null; Invoke-WebRequest https://ridhoofrahman.github.io/Slide-preview-automation/slide-qa-marker/lab/compile/manifest.xml -OutFile "$d\compile-lab.xml"; New-Item -Path "HKCU:\Software\Microsoft\Office\16.0\WEF\Developer" -Force | Out-Null; Set-ItemProperty -Path "HKCU:\Software\Microsoft\Office\16.0\WEF\Developer" -Name "692f0c9c-69c2-4b13-bddc-494439c729d9" -Value "$d\compile-lab.xml"
```
Already installed? Only re-download the manifest:
```
Invoke-WebRequest https://ridhoofrahman.github.io/Slide-preview-automation/slide-qa-marker/lab/compile/manifest.xml -OutFile "$env:LOCALAPPDATA\CompileLab\compile-lab.xml"
```
Close PowerPoint completely and open it again.

## 3. Test: auto-compile
1. In one or two saved files: select slides → Compile Lab → **Send selected slides** (they join the pool).
2. File → New blank presentation → Compile Lab → section 3 → **Make this file a starter**.
3. Save it as `compile-starter.pptx` and close it.
4. Open `compile-starter.pptx`. Watch what happens:
   - Does the Compile Lab panel open by itself? Is there a "trust this add-in" question?
   - A 3-second countdown, then the pool is compiled into the file.
   - The Result block shows slide count, slide masters and layouts (before → after) and the size of the file read back.
5. **Open this copy** opens the read-back bytes as a new presentation. If it looks right, those bytes are what would be uploaded.
6. **Read file again** simulates the DM saving again after editing.

## 4. What to find out
- **Opens by itself?** On Mac, and on a Windows PC.
- **Protected View:** send the starter file to yourself (Slack or email), download it, and open it from Downloads. Does the panel open right away, or only after you click Enable Editing?
- **Duplicate masters:** compare "Slide masters" and "Layouts" for both options, *Keep each slide's own look* and *Use this file's theme*. A big jump after compile means duplicated designs.
- **Fidelity:** compare the compiled deck with the originals (fonts, layouts, images, charts, animations, speaker notes).

## Notes
- The starter file is only opened by hand in this test. In the real flow, the dashboard would hand it to PowerPoint.
- Auto-compile is skipped if the file already has slides (so opening a starter twice does not duplicate slides). Press Compile to force it.
- The pool lives inside the add-in on one computer (IndexedDB), shared by every file opened there. Nothing is uploaded yet. On another computer, send a few slides first.
- Splitting needs PowerPointApi 1.8 (recent Microsoft 365). The footer shows if it's supported.
