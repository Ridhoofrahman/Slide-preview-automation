#!/bin/bash
# Slideshot installer for PowerPoint on Mac. No admin rights needed. Run in Terminal:
#   curl -fsSL https://ridhoofrahman.github.io/Slide-preview-automation/slide-qa-marker/install/install-mac.sh | bash
# Downloads the latest manifest, puts it where PowerPoint looks for add-ins (the "wef" folder),
# removes older copies of Slideshot and reopens PowerPoint. Run it again any time to update.
set -euo pipefail
MANIFEST_URL="${SLIDESHOT_MANIFEST_URL:-https://ridhoofrahman.github.io/Slide-preview-automation/slide-qa-marker/manifest.xml}"
WEF="$HOME/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef"
APP="Microsoft PowerPoint"

if [ -z "${SLIDESHOT_SKIP_APP_CHECK:-}" ] && [ ! -d "/Applications/Microsoft PowerPoint.app" ]; then
  echo "PowerPoint for Mac was not found in /Applications. Install Microsoft PowerPoint first."; exit 1
fi

tmp="$(mktemp)"
if ! curl -fsSL "${MANIFEST_URL}?v=$(date +%s)" -o "$tmp"; then
  echo "Could not download Slideshot. Check your internet connection and try again."; rm -f "$tmp"; exit 1
fi
if ! grep -q "<OfficeApp" "$tmp"; then
  echo "The downloaded file is not a Slideshot manifest. Nothing was changed."; rm -f "$tmp"; exit 1
fi
id="$(sed -n 's:.*<Id>\([^<]*\)</Id>.*:\1:p' "$tmp" | head -1)"
version="$(sed -n 's:.*<Version>\([^<]*\)</Version>.*:\1:p' "$tmp" | head -1)"

# PowerPoint only reads add-ins when it starts, so close it first (it asks to save open files)
if pgrep -x "$APP" >/dev/null 2>&1; then
  echo "Closing PowerPoint. Save your files if it asks..."
  osascript -e "tell application \"$APP\" to quit" >/dev/null 2>&1 || true
  for _ in $(seq 1 90); do pgrep -x "$APP" >/dev/null 2>&1 || break; sleep 1; done
  if pgrep -x "$APP" >/dev/null 2>&1; then
    echo "PowerPoint is still open. Close it (Cmd+Q) and run this again."; rm -f "$tmp"; exit 1
  fi
fi

mkdir -p "$WEF"
# Remove older copies of Slideshot (same add-in Id, whatever the file is called)
if [ -n "$id" ]; then
  for f in "$WEF"/*.xml; do
    [ -e "$f" ] || continue
    if grep -q "$id" "$f"; then rm -f "$f"; fi
  done
fi
mv "$tmp" "$WEF/slideshot.xml"
chmod 644 "$WEF/slideshot.xml"

echo "Slideshot ${version:-} is installed."
echo "In PowerPoint: Insert > Add-ins > My Add-ins > Developer Add-ins > Slideshot."
if command -v osascript >/dev/null 2>&1; then open -a "$APP" >/dev/null 2>&1 || true; fi
