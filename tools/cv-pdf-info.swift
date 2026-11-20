// cv-pdf-info.swift — used by tools/update-cv.sh (macOS only, no installs).
// Prints the page count, then any phone-number-like text found in the PDF,
// so a private number never slips onto the public site.
//   swift tools/cv-pdf-info.swift path/to/cv.pdf
import Foundation
import PDFKit

guard CommandLine.arguments.count > 1,
      let doc = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1])) else {
    print("ERROR cannot open PDF"); exit(1)
}
print("PAGES \(doc.pageCount)")
var text = ""
for i in 0..<doc.pageCount { text += (doc.page(at: i)?.string ?? "") + "\n" }
// join digits broken across lines by the PDF layout, then look for phone shapes
let squashed = text.replacingOccurrences(of: "\n", with: "")
let pattern = #"\+\s?\d[\d\s\-().]{8,}\d"#
if let re = try? NSRegularExpression(pattern: pattern) {
    let ns = squashed as NSString
    for m in re.matches(in: squashed, range: NSRange(location: 0, length: ns.length)) {
        let hit = ns.substring(with: m.range)
        if hit.filter(\.isNumber).count >= 10 { print("PHONE \(hit)") }
    }
}
