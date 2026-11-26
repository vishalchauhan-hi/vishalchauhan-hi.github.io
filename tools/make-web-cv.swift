// make-web-cv.swift — step 1 of making the public web copy of your CV (macOS, no installs).
// Called by tools/update-cv.sh; you don't need to run it yourself.
//
//   swift tools/make-web-cv.swift input.pdf work-dir/
//
// It finds what must not be public and renders those pages without it, writing
// work-dir/page-N.jpg and work-dir/manifest.json. Step 2 (tools/make-web-cv.py)
// builds the final PDF: untouched pages are copied byte-for-byte (text stays
// selectable) and only the changed pages are swapped for the redacted images.
//
// What it changes, and only this:
//   • the phone number on the contact line is removed
//   • the REFEREES section is replaced with "Available on request."
// Pages that need a change are redrawn as an image so the removed text is truly
// gone from the file (a white box alone would leave it hidden but still inside).
// Clickable links on those pages (Website, Scholar, GitHub, …) are kept, except
// links that sat inside a removed area. All other pages are untouched.
import AppKit
import Foundation
import PDFKit

let args = CommandLine.arguments
guard args.count == 3, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
    print("Usage: swift tools/make-web-cv.swift input.pdf work-dir"); exit(1)
}

let phoneRegex = try! NSRegularExpression(pattern: #"\+\s*[\d\s]{1,6}[\d\s\-().]{6,}\d"#)
let scale: CGFloat = 3   // 216 dpi: sharp on screen and in print

func box(_ s: PDFSelection, _ page: PDFPage) -> CGRect { s.bounds(for: page) }

var changed = 0
var manifest: [[String: Any]] = []
try? FileManager.default.createDirectory(atPath: args[2], withIntermediateDirectories: true)
for i in 0..<doc.pageCount {
    guard let page = doc.page(at: i) else { continue }
    let bounds = page.bounds(for: .mediaBox)
    var covers: [CGRect] = []
    var note: (String, CGPoint)? = nil

    // 1. phone number: cover from the end of the text before it to the end of its line
    if let text = page.string {
        let flat = text.replacingOccurrences(of: "\n", with: "")
        let ns = flat as NSString
        for m in phoneRegex.matches(in: flat, range: NSRange(location: 0, length: ns.length)) {
            let digits = ns.substring(with: m.range).filter(\.isNumber)
            guard digits.count >= 10 else { continue }
            let tail = String(digits.suffix(4))
            for sel in doc.findString(tail, withOptions: []) where sel.pages.first == page {
                guard let line = sel.selectionsByLine().first else { continue }
                let lineBox = box(line, page)
                // start at the "·" separator that sits just before the number on this line
                var start = lineBox.minX - 60          // fallback if there is no separator
                var best = -CGFloat.greatestFiniteMagnitude
                for dot in doc.findString("·", withOptions: []) where dot.pages.first == page {
                    let d = box(dot, page)
                    if abs(d.midY - lineBox.midY) < 4, d.maxX <= lineBox.minX, d.minX > best { best = d.minX }
                }
                if best > -CGFloat.greatestFiniteMagnitude { start = best - 1 }
                covers.append(CGRect(x: start - 1, y: lineBox.minY - 2, width: bounds.maxX - 36 - start, height: lineBox.height + 4))
            }
        }
    }

    // 2. REFEREES section: keep the heading, replace everything under it
    for sel in doc.findString("REFEREES", withOptions: []) where sel.pages.first == page {
        let h = box(sel, page)
        var bottom = bounds.minY + 30
        // stop above the page number line ("6 / 6") if there is one
        if let s = page.string, let r = s.range(of: #"\d+ / \d+"#, options: .regularExpression),
           let pn = doc.findString(String(s[r]), withOptions: []).first(where: { $0.pages.first == page }) {
            bottom = box(pn, page).maxY + 2
        }
        let top = h.minY - 3
        covers.append(CGRect(x: bounds.minX + 30, y: bottom, width: bounds.width - 60, height: top - bottom))
        note = ("Available on request.", CGPoint(x: h.minX, y: h.minY - 16))
    }

    if covers.isEmpty { continue }

    // redraw the page as an image with the covered areas blank
    let w = Int(bounds.width * scale), hgt = Int(bounds.height * scale)
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(data: nil, width: w, height: hgt, bitsPerComponent: 8, bytesPerRow: 0,
                              space: cs, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { continue }
    ctx.setFillColor(NSColor.white.cgColor); ctx.fill(CGRect(x: 0, y: 0, width: w, height: hgt))
    ctx.scaleBy(x: scale, y: scale)
    ctx.translateBy(x: -bounds.minX, y: -bounds.minY)
    page.draw(with: .mediaBox, to: ctx)
    ctx.setFillColor(NSColor.white.cgColor)
    for c in covers { ctx.fill(c) }
    if let (msg, at) = note {
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)
        (msg as NSString).draw(at: at, withAttributes: [.font: NSFont.systemFont(ofSize: 9.5), .foregroundColor: NSColor(white: 0.2, alpha: 1)])
        NSGraphicsContext.restoreGraphicsState()
    }
    // compress the redrawn page as JPEG
    guard let cg = ctx.makeImage(),
          let jpeg = NSBitmapImageRep(cgImage: cg).representation(using: .jpeg, properties: [.compressionFactor: 0.7]),
          let src = CGImageSourceCreateWithData(jpeg as CFData, nil),
          let jpegImage = CGImageSourceCreateImageAtIndex(src, 0, nil) else { continue }

    let name = "page-\(i + 1).jpg"
    try! jpeg.write(to: URL(fileURLWithPath: args[2]).appendingPathComponent(name))
    manifest.append(["index": i, "jpeg": name, "width": jpegImage.width, "height": jpegImage.height,
                     "covers": covers.map { [$0.minX, $0.minY, $0.width, $0.height] }])
    changed += 1
    print("page \(i + 1): removed \(covers.count) area(s)\(note != nil ? " · referees → available on request" : "")")
}
let json = try! JSONSerialization.data(withJSONObject: ["pages": manifest], options: [.prettyPrinted])
try! json.write(to: URL(fileURLWithPath: args[2]).appendingPathComponent("manifest.json"))
print("\(changed) page(s) to replace")
