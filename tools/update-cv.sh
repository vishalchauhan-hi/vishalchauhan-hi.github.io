#!/bin/zsh
# update-cv.sh — put a new CV PDF on the site in one step (macOS).
#
#   tools/update-cv.sh ~/Documents/Vishal_Chauhan_CV_web.pdf
#
# It will:
#   1. refuse the file if it still contains a phone number (use the web copy)
#   2. copy it to assets/cv/Vishal_Chauhan_CV.pdf (the link never changes)
#   3. make the small first-page preview (assets/cv/cv-preview.jpg)
#   4. set "N pages · updated <Mon YYYY>" on the CV page
#   5. run the site checks
# Then commit on a branch and open a PR as usual (see README).
set -e
cd "$(dirname "$0")/.."

SRC="$1"
if [[ -z "$SRC" || ! -f "$SRC" ]]; then
  echo "Usage: tools/update-cv.sh path/to/your-cv.pdf"; exit 1
fi

echo "Reading the PDF…"
INFO="$(swift tools/cv-pdf-info.swift "$SRC" 2>/dev/null)"
PAGES="$(print -r -- "$INFO" | awk '/^PAGES/{print $2}')"
if [[ -z "$PAGES" ]]; then echo "Could not read the PDF."; exit 1; fi
if print -r -- "$INFO" | grep -q '^PHONE'; then
  echo "✗ This PDF still contains a phone number:"
  print -r -- "$INFO" | grep '^PHONE' | sed 's/^PHONE /    /'
  echo "  Export a web copy without it, then run this again."
  exit 1
fi

mkdir -p assets/cv
cp "$SRC" assets/cv/Vishal_Chauhan_CV.pdf

TMP="$(mktemp -d)"
qlmanage -t -s 900 -o "$TMP" assets/cv/Vishal_Chauhan_CV.pdf >/dev/null 2>&1
sips -s format jpeg -s formatOptions 80 -Z 600 "$TMP"/*.png --out assets/cv/cv-preview.jpg >/dev/null
rm -rf "$TMP"

UPDATED="$(LC_ALL=C date +'%b %Y')"
perl -0pi -e "s#(<span data-cv-pages>)[^<]*(</span>)#\${1}$PAGES\${2}#; s#(<span data-cv-updated>)[^<]*(</span>)#\${1}$UPDATED\${2}#" cv.html

echo "✓ CV updated: $PAGES pages · updated $UPDATED"
node scripts/check-site.mjs
