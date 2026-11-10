import Foundation
import AVFoundation
import CoreGraphics
import ImageIO

// 실제 브라우저에서 촬영한 JPEG 프레임을 이어 붙인다. 앱 화면을 다시 그리지 않는다.
// 대신 각 구간에 카메라 무빙(푸시인·펀치인·풀백)과 구간 전환 크로스페이드를 넣어
// 녹화가 정지 화면 나열로 보이지 않게 한다.
struct Frame: Decodable { let file: String; let at: Double }
struct Clip: Decodable { let name: String; let start: Double; let duration: Double; let rawDuration: Double; let frames: [Frame] }
struct Manifest: Decodable { let width: Int; let height: Int; let duration: Double; let clips: [Clip] }
enum RenderError: Error { case invalidManifest, image(String), writer(String) }

// 구간별 카메라: (구간 내 시각, 배율, 초점 x, 초점 y). 초점은 원본 화면 비율 좌표.
let camera: [String: [(Double, Double, Double, Double)]] = [
    "profile": [(0, 1.02, 0.48, 0.48), (3, 1.10, 0.44, 0.48), (7.99, 1.20, 0.40, 0.45)],
    "publish": [(0, 1.02, 0.50, 0.45), (3.5, 1.14, 0.40, 0.45), (8, 1.28, 0.36, 0.52), (11, 1.28, 0.36, 0.52), (12.99, 1.08, 0.46, 0.50)],
    "reactions": [(0, 1.06, 0.44, 0.48), (3.5, 1.20, 0.42, 0.58), (8.99, 1.10, 0.46, 0.50)],
    "program": [(0, 1.00, 0.50, 0.50), (2, 1.10, 0.46, 0.50), (5, 1.18, 0.47, 0.47), (8.99, 1.26, 0.48, 0.45)],
    "accepted": [(0, 1.12, 0.45, 0.50), (1.49, 1.24, 0.45, 0.48)],
    "feedback": [(0, 1.06, 0.52, 0.55), (2, 1.14, 0.52, 0.58), (4.49, 1.20, 0.52, 0.60)],
    "review": [(0, 1.08, 0.50, 0.45), (2, 1.16, 0.50, 0.48), (3.99, 1.22, 0.50, 0.52)],
]
// 초점을 화면 중앙으로 보내되, 배율이 늘어난 만큼 가장자리가 빈칸으로 남지 않게 클램프한다.
func rect(of scale: Double, fx: Double, fy: Double, w: Int, h: Int) -> CGRect {
    let width = Double(w) * scale, height = Double(h) * scale
    let x = max(Double(w) - width, min(0, Double(w) / 2 - fx * width))
    let y = max(Double(h) - height, min(0, Double(h) / 2 - fy * height))
    return CGRect(x: x, y: y, width: width, height: height)
}
func ease(_ t: Double) -> Double { t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2 }
func camera(at t: Double, keys: [(Double, Double, Double, Double)]) -> (Double, Double, Double) {
    guard let last = keys.last else { return (1, 0.5, 0.5) }
    if t >= last.0 { return (last.1, last.2, last.3) }
    for (a, b) in zip(keys, keys.dropFirst()) where t >= a.0 && t < b.0 {
        let p = ease((t - a.0) / max(b.0 - a.0, 0.001))
        return (a.1 + (b.1 - a.1) * p, a.2 + (b.2 - a.2) * p, a.3 + (b.3 - a.3) * p)
    }
    return (keys[0].1, keys[0].2, keys[0].3)
}

guard CommandLine.arguments.count == 3 else {
    fatalError("Usage: swift scripts/render-demo.swift <manifest.json> <output.mp4>")
}
let manifest = try JSONDecoder().decode(Manifest.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
guard manifest.duration == 60, manifest.clips.count == 7,
      manifest.clips.first?.start == 5,
      manifest.clips.allSatisfy({ !$0.frames.isEmpty && $0.rawDuration > 0 }),
      zip(manifest.clips, manifest.clips.dropFirst()).allSatisfy({ abs($0.start + $0.duration - $1.start) < 0.001 }),
      let last = manifest.clips.last, last.start + last.duration == 54 else { throw RenderError.invalidManifest }
let destination = URL(fileURLWithPath: CommandLine.arguments[2])
try? FileManager.default.removeItem(at: destination)
let writer = try AVAssetWriter(outputURL: destination, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: manifest.width, AVVideoHeightKey: manifest.height,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 5_000_000, AVVideoExpectedSourceFrameRateKey: 30, AVVideoMaxKeyFrameIntervalKey: 60]
])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
    kCVPixelBufferWidthKey as String: manifest.width, kCVPixelBufferHeightKey as String: manifest.height,
    kCVPixelBufferCGImageCompatibilityKey as String: true, kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
])
writer.add(input)
guard writer.startWriting() else { throw RenderError.writer(writer.error?.localizedDescription ?? "startWriting") }
writer.startSession(atSourceTime: .zero)

let fade: Double = 0.35
@MainActor func append(_ layers: [(String, CGRect, Double)], at seconds: Double) async throws {
    while !input.isReadyForMoreMediaData {
        if writer.status == .failed { throw RenderError.writer(writer.error?.localizedDescription ?? "failed") }
        try await Task.sleep(nanoseconds: 1_000_000)
    }
    try autoreleasepool {
        guard let pool = adaptor.pixelBufferPool else { throw RenderError.writer("pixelBufferPool") }
        var pixel: CVPixelBuffer?
        guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pixel) == kCVReturnSuccess, let buffer = pixel else { throw RenderError.writer("pixelBuffer") }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: manifest.width, height: manifest.height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue) else { throw RenderError.writer("CGContext") }
        for (file, destination, alpha) in layers {
            guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: file) as CFURL, nil),
                  let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw RenderError.image(file) }
            context.setAlpha(alpha)
            context.draw(image, in: destination)
        }
        context.setAlpha(1)
        guard adaptor.append(buffer, withPresentationTime: CMTime(seconds: seconds, preferredTimescale: 60_000)) else { throw RenderError.writer(writer.error?.localizedDescription ?? "append") }
    }
}

var previous = 0.0
var count = 0
for (index, clip) in manifest.clips.enumerated() {
    let keys = camera[clip.name] ?? []
    let before = index > 0 ? manifest.clips[index - 1] : nil
    let beforeEnd = before.flatMap { clip in camera[clip.name]?.last }.map { rect(of: $0.1, fx: $0.2, fy: $0.3, w: manifest.width, h: manifest.height) }
    // 촬영은 다시 그려지는 순간에만 프레임을 준다. 페이지가 멈춰 있으면 표본이 드문 듯해
    // 카메라가 얼어붙으므로, 구간을 30fps로 균등 재표본화해 매 틱 가장 가까운 촬영 프레임을 쓴다.
    let sorted = clip.frames.sorted { $0.at < $1.at }.map { (file: $0.file, at: $0.at / clip.rawDuration) }
    for tick in stride(from: 0.0, through: clip.duration, by: 1.0 / 30) {
        let seconds = clip.start + tick
        if seconds <= previous { continue }
        let nearest = sorted.min { abs($0.at - tick / clip.duration) < abs($1.at - tick / clip.duration) } ?? sorted[0]
        let (scale, fx, fy) = camera(at: tick, keys: keys)
        var layers = [(nearest.file, rect(of: scale, fx: fx, fy: fy, w: manifest.width, h: manifest.height), 1.0)]
        // 구간 시작 0.35초는 이전 구간 마지막 화면을 서로 겹쳐 크로스페이드한다.
        if let before = before, let beforeEnd = beforeEnd, tick < fade, let lastFrame = before.frames.last {
            layers = [(lastFrame.file, beforeEnd, 1 - tick / fade), layers[0]]
        }
        try await append(layers, at: seconds)
        previous = seconds
        count += 1
    }
}
// 종료 구간도 30fps 표본으로 채워 마지막 긴 표본 때문에 브라우저의 반복이 지연되지 않게 한다.
let endKeys = camera[last.name]?.last ?? (0, 1.0, 0.5, 0.5)
let endRect = rect(of: endKeys.1, fx: endKeys.2, fy: endKeys.3, w: manifest.width, h: manifest.height)
for index in 0..<180 {
    let seconds = 54 + Double(index) / 30
    if seconds > previous { try await append([(last.frames.last!.file, endRect, 1.0)], at: seconds); count += 1 }
}
writer.endSession(atSourceTime: CMTime(seconds: manifest.duration, preferredTimescale: 60_000))
input.markAsFinished()
await writer.finishWriting()
guard writer.status == .completed else { throw RenderError.writer(writer.error?.localizedDescription ?? "finishWriting") }
let result = AVURLAsset(url: destination)
let duration = CMTimeGetSeconds(try await result.load(.duration))
guard abs(duration - 60) < 0.1, try await result.loadTracks(withMediaType: .audio).isEmpty else { throw RenderError.writer("duration/audio self-check") }
let posterURL = destination.deletingLastPathComponent().appendingPathComponent(destination.deletingPathExtension().lastPathComponent + "-poster.jpg")
let posterFrame = manifest.clips.first(where: { $0.name == "publish" })!.frames.last!.file
guard let posterSource = CGImageSourceCreateWithURL(URL(fileURLWithPath: posterFrame) as CFURL, nil),
      let poster = CGImageSourceCreateImageAtIndex(posterSource, 0, nil),
      let posterWriter = CGImageDestinationCreateWithURL(posterURL as CFURL, "public.jpeg" as CFString, 1, nil) else { throw RenderError.image("poster") }
CGImageDestinationAddImage(posterWriter, poster, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
guard CGImageDestinationFinalize(posterWriter) else { throw RenderError.image("poster write") }
print("Rendered actual-page footage with camera moves; \(duration)s; no audio; \(destination.path)")
