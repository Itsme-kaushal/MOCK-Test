import Foundation
import Vision
import AppKit

// Local, offline OCR. The original image remains the authoritative display.
let paths = try JSONDecoder().decode([String].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
let output = URL(fileURLWithPath: CommandLine.arguments[2])
FileManager.default.createFile(atPath: output.path, contents: nil)
let handle = try FileHandle(forWritingTo: output)
for (index, path) in paths.enumerated() {
    autoreleasepool {
        do {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["en-US"]
            request.usesLanguageCorrection = false
            try VNImageRequestHandler(url: URL(fileURLWithPath: path), options: [:]).perform([request])
            let observations = request.results ?? []
            let values = observations.compactMap { $0.topCandidates(1).first }
            let row: [String: Any] = ["path": path, "text": values.map { $0.string }.joined(separator: "\n"), "confidence": values.isEmpty ? 0 : values.map { Double($0.confidence) }.reduce(0, +) / Double(values.count)]
            var data = try JSONSerialization.data(withJSONObject: row, options: [.sortedKeys])
            data.append(10)
            handle.write(data)
        } catch {
            let row: [String: Any] = ["path": path, "text": "", "confidence": 0, "error": String(describing: error)]
            if var data = try? JSONSerialization.data(withJSONObject: row) { data.append(10); handle.write(data) }
        }
    }
    if (index + 1) % 100 == 0 { print("OCR \(index + 1)/\(paths.count)"); fflush(stdout) }
}
try handle.close()
