#!/usr/bin/env python3
"""Shrink images so the site stays fast, and strip photo metadata (GPS, camera).

Usage (from the repo root):
    python3 tools/optimize-images.py                    # every image in the site
    python3 tools/optimize-images.py assets/images/new.jpg another.png

Safe to run any time: files keep their names and formats, files that are
already small are left alone, and photos are turned upright before saving.
  • JPEG photos  -> at most 1800 px on the long side, quality 80, no EXIF
  • PNG figures  -> at most 1200 px wide, 256-colour palette (keeps transparency)
  • photo.jpg    -> at most 1000 px (the homepage portrait)
Needs Pillow once:  python3 -m pip install --user pillow
"""
import os
import sys

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow is not installed. Run:  python3 -m pip install --user pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {".git", "node_modules", "scripts", "tools", ".github"}
EXTS = {".jpg", ".jpeg", ".png"}
SMALL = 250 * 1024          # PNGs under this size are left alone
BUDGET = 600 * 1024         # same limit as scripts/check-site.mjs


def all_images():
    for d, dirs, files in os.walk(ROOT):
        dirs[:] = [x for x in dirs if x not in SKIP]
        for f in files:
            if os.path.splitext(f)[1].lower() in EXTS and not f.startswith(("favicon", "apple-touch")):
                yield os.path.join(d, f)


def optimise(path):
    before = os.path.getsize(path)
    ext = os.path.splitext(path)[1].lower()
    im = Image.open(path)
    im.load()
    if ext in (".jpg", ".jpeg"):
        im = ImageOps.exif_transpose(im).convert("RGB")
        has_exif = bool(Image.open(path).info.get("exif"))
        limit = 1000 if os.path.basename(path) == "photo.jpg" else 1800
        if max(im.size) <= limit and not has_exif and before <= BUDGET:
            return None          # already done: re-saving a JPEG only loses quality
        im.thumbnail((limit, limit), Image.LANCZOS)
        im.save(path, "JPEG", quality=80, optimize=True, progressive=True)
    else:
        if im.width <= 1200 and (im.mode == "P" or before < SMALL):
            return None          # already a small palette PNG
        if im.width > 1200:
            im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA").quantize(256, method=Image.FASTOCTREE)
        else:
            im = im.convert("RGB").quantize(256, method=Image.MEDIANCUT)
        im.save(path, optimize=True)
    return before, os.path.getsize(path)


def main():
    targets = [os.path.abspath(p) for p in sys.argv[1:]] or list(all_images())
    changed = 0
    for p in targets:
        if not os.path.exists(p):
            print(f"  not found: {p}")
            continue
        r = optimise(p)
        if r:
            changed += 1
            print(f"  {os.path.relpath(p, ROOT)}: {r[0] // 1024} KB -> {r[1] // 1024} KB")
    print(f"Done. {changed} image(s) optimised." if changed else "All images are already small. Nothing to do.")


if __name__ == "__main__":
    main()
