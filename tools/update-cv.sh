#!/bin/zsh
# update-cv.sh — put a new CV PDF on the site in one step (macOS).
#
#   tools/update-cv.sh ~/Downloads/02_Curriculum_Vitae.pdf
#
# Give it your normal CV. It will:
#   1. make the public web copy: removes the phone number and replaces the
#      Referees section with "Available on request." (your original is untouched)
#   2. double-check the web copy has no phone number left, or stop
#   3. save it as assets/cv/Vishal_Chauhan_CV.pdf (the link never changes)
#   4. make the small first-page preview (assets/cv/cv-preview.jpg)
#   5. set "N pages · updated <Mon YYYY>" on the CV page
#   6. run the site checks
# Then commit on a branch and open a PR as usual (see README).
set -e
cd "$(dirname "$0")/.."

SRC="$1"
if [[ -z "$SRC" || ! -f "$SRC" ]]; then
  echo "Usage: tools/update-cv.sh path/to/your-cv.pdf"; exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Making the web copy…"
swift tools/make-web-cv.swift "$SRC" "$WORK/pages" 2>/dev/null
python3 tools/make-web-cv.py "$SRC" "$WORK/pages" "$WORK/web.pdf"

echo "Checking the web copy…"
INFO="$(swift tools/cv-pdf-info.swift "$WORK/web.pdf" 2>/dev/null)"
PAGES="$(print -r -- "$INFO" | awk '/^PAGES/{print $2}')"
if [[ -z "$PAGES" ]]; then echo "Could not read the web copy."; exit 1; fi
if print -r -- "$INFO" | grep -q '^PHONE'; then
  echo "✗ The web copy still contains a phone number:"
  print -r -- "$INFO" | grep '^PHONE' | sed 's/^PHONE /    /'
  echo "  Nothing was changed on the site."
  exit 1
fi

mkdir -p assets/cv
cp "$WORK/web.pdf" assets/cv/Vishal_Chauhan_CV.pdf

qlmanage -t -s 900 -o "$WORK" assets/cv/Vishal_Chauhan_CV.pdf >/dev/null 2>&1
sips -s format jpeg -s formatOptions 80 -Z 600 "$WORK"/Vishal_Chauhan_CV.pdf.png --out assets/cv/cv-preview.jpg >/dev/null

UPDATED="$(LC_ALL=C date +'%b %Y')"
perl -0pi -e "s#(<span data-cv-pages>)[^<]*(</span>)#\${1}$PAGES\${2}#; s#(<span data-cv-updated>)[^<]*(</span>)#\${1}$UPDATED\${2}#" cv.html

echo "✓ CV updated: $PAGES pages · updated $UPDATED"
node scripts/check-site.mjs
