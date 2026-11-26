#!/usr/bin/env python3
"""make-web-cv.py — step 2 of making the public web copy of your CV (no installs).
Called by tools/update-cv.sh; you don't need to run it yourself.

    python3 tools/make-web-cv.py input.pdf work-dir/ output.pdf

Reads work-dir/manifest.json (written by tools/make-web-cv.swift) and writes a
new PDF in which:
  • every untouched page is copied exactly as it is (text stays selectable),
  • each changed page shows its redacted image instead of its old content,
  • links on changed pages are kept unless they sat inside a removed area,
  • anything no longer referenced (the removed text) is left out of the file.
Works with plain PDFs such as those saved from Chrome or Word (classic xref table).
"""
import json
import os
import re
import sys

src_path, work, out_path = sys.argv[1:4]
data = open(src_path, "rb").read()
manifest = json.load(open(os.path.join(work, "manifest.json")))

if b"/ObjStm" in data or b"/XRef" in data:
    sys.exit("This PDF uses compressed object streams. Export it again from your editor "
             "(e.g. Print → Save as PDF) and retry.")

# ---- read the classic xref table(s) ----
start = int(re.findall(rb"startxref\s+(\d+)", data)[-1])
offsets = {}
pos = start
while True:
    m = re.compile(rb"xref\s*").match(data, pos)
    if not m:
        sys.exit("Unexpected PDF structure (no xref table).")
    pos = m.end()
    while True:
        h = re.compile(rb"(\d+) (\d+)\s*\r?\n").match(data, pos)
        if not h:
            break
        first, count = int(h.group(1)), int(h.group(2))
        pos = h.end()
        for k in range(count):
            entry = data[pos:pos + 20]
            off, _gen, kind = entry[:10], entry[11:16], entry[17:18]
            if kind == b"n" and (first + k) not in offsets:
                offsets[first + k] = int(off)
            pos += 20
    trailer = re.compile(rb"\s*trailer\s*(<<.*?>>)\s*", re.S).match(data, pos)
    tdict = trailer.group(1)
    prev = re.search(rb"/Prev\s+(\d+)", tdict)
    if not prev:
        break
    pos = int(prev.group(1))
root_trailer = re.findall(rb"trailer\s*(<<.*?>>)", data, re.S)[-1]

# raw bytes of each object: from its offset to the next object's offset
order = sorted(offsets.items(), key=lambda kv: kv[1])
ends = {n: (order[i + 1][1] if i + 1 < len(order) else start) for i, (n, _) in enumerate(order)}
objs = {}
for n, off in offsets.items():
    raw = data[off:ends[n]]
    cut = raw.rfind(b"endobj")
    objs[n] = raw[:cut + len(b"endobj")]


def body(raw):
    """Object content between 'N 0 obj' and 'endobj' (dict part only for streams)."""
    b = re.sub(rb"^\s*\d+\s+\d+\s+obj\s*", b"", raw, count=1)
    b = b[: b.rfind(b"endobj")]
    i = b.find(b"stream")
    return b if i < 0 else b[:i]


def refs(raw):
    return [int(x) for x in re.findall(rb"(\d+)\s+0\s+R", body(raw))]


def balanced(s, i):
    """Return end index of the << … >> dict starting at s[i]."""
    depth, j = 0, i
    while j < len(s):
        if s[j:j + 2] == b"<<":
            depth += 1; j += 2; continue
        if s[j:j + 2] == b">>":
            depth -= 1; j += 2
            if depth == 0:
                return j
            continue
        j += 1
    raise ValueError("unbalanced dict")


# ---- find the page objects in reading order ----
root = int(re.search(rb"/Root\s+(\d+)\s+0\s+R", root_trailer).group(1))
info = re.search(rb"/Info\s+(\d+)\s+0\s+R", root_trailer)


def kids_of(n):
    b = body(objs[n])
    if re.search(rb"/Type\s*/Page\b(?!s)", b):
        return [n]
    out = []
    for k in re.findall(rb"(\d+)\s+0\s+R", re.search(rb"/Kids\s*\[(.*?)\]", b, re.S).group(1)):
        out += kids_of(int(k))
    return out


pages_root = int(re.search(rb"/Pages\s+(\d+)\s+0\s+R", body(objs[root])).group(1))
pages = kids_of(pages_root)

# ---- swap in the redacted pages ----
next_num = max(offsets) + 1
for p in manifest["pages"]:
    pn = pages[p["index"]]
    head = re.match(rb"^\s*\d+\s+\d+\s+obj\s*", objs[pn]).group(0)
    b = body(objs[pn]).strip()
    mb = [float(x) for x in re.search(rb"/MediaBox\s*\[([^\]]*)\]", b).group(1).split()]
    W, H = mb[2] - mb[0], mb[3] - mb[1]

    jpeg = open(os.path.join(work, p["jpeg"]), "rb").read()
    img_n, cnt_n = next_num, next_num + 1
    next_num += 2
    objs[img_n] = (b"%d 0 obj\n<</Type /XObject /Subtype /Image /Width %d /Height %d "
                   b"/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %d>>\nstream\n"
                   % (img_n, p["width"], p["height"], len(jpeg)) + jpeg + b"\nendstream\nendobj")
    content = b"q %.3f 0 0 %.3f %.3f %.3f cm /Im0 Do Q" % (W, H, mb[0], mb[1])
    objs[cnt_n] = b"%d 0 obj\n<</Length %d>>\nstream\n%s\nendstream\nendobj" % (cnt_n, len(content), content)

    # new Resources / Contents
    i = b.find(b"/Resources")
    j = b.find(b"<<", i)
    k = balanced(b, j) if b[i + 10:j].strip() == b"" else re.search(rb"/Resources\s+\d+\s+0\s+R", b).end()
    b = b[:i] + b"/Resources <</XObject <</Im0 %d 0 R>>>>" % img_n + b[k:]
    b = re.sub(rb"/Contents\s+(\d+\s+0\s+R|\[[^\]]*\])", b"/Contents %d 0 R" % cnt_n, b)

    # keep links that are outside the removed areas
    covers = p["covers"]
    m = re.search(rb"/Annots\s*\[([^\]]*)\]", b)
    if m:
        keep = []
        for a in re.findall(rb"(\d+)\s+0\s+R", m.group(1)):
            r = re.search(rb"/Rect\s*\[([^\]]*)\]", body(objs[int(a)]))
            x1, y1, x2, y2 = [float(v) for v in r.group(1).split()] if r else (0, 0, 0, 0)
            hit = any(x1 < cx + cw and x2 > cx and y1 < cy + ch and y2 > cy for cx, cy, cw, ch in covers)
            if not hit:
                keep.append(a)
        b = b[:m.start()] + b"/Annots [" + b" ".join(x + b" 0 R" for x in keep) + b"]" + b[m.end():]
    objs[pn] = head + b + b"\nendobj"

# ---- write only what is still referenced ----
seen, todo = set(), [root] + ([int(info.group(1))] if info else [])
while todo:
    n = todo.pop()
    if n in seen or n not in objs:
        continue
    seen.add(n)
    todo += refs(objs[n])

out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
where = {}
for n in sorted(seen):
    where[n] = len(out)
    out += objs[n].strip() + b"\n"
xref_at = len(out)
size = max(seen) + 1
out += b"xref\n0 %d\n0000000000 65535 f \n" % size
for n in range(1, size):
    out += (b"%010d 00000 n \n" % where[n]) if n in where else b"0000000000 65535 f \n"
out += b"trailer\n<</Size %d /Root %d 0 R%s>>\nstartxref\n%d\n%%%%EOF\n" % (
    size, root, (b" /Info %s 0 R" % info.group(1)) if info else b"", xref_at)
open(out_path, "wb").write(out)
print(f"✓ web copy written: {out_path} ({len(out) // 1024} KB, {len(manifest['pages'])} page(s) replaced)")
