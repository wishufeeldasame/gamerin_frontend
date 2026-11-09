import Foundation
import AVFoundation
import CoreGraphics
import ImageIO

// 실제 브라우저에서 촬영한 JPEG 프레임만 이어 붙인다. 앱 화면을 다시 그리지 않는다.
struct Frame: Decodable { let file: String; let at: Double }
struct Clip: Decodable { let name: String; let start: Double; let duration: Double; let rawDuration: Double; let frames: [Frame] }
struct Manifest: Decodable { let width: Int; let height: Int; let duration: Double; let clips: [Clip] }
enum RenderError: Error { case invalidManifest, image(String), writer(String) }

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

@MainActor func append(_ file: String, at seconds: Double) async throws {
    while !input.isReadyForMoreMediaData {
        if writer.status == .failed { throw RenderError.writer(writer.error?.localizedDescription ?? "failed") }
        try await Task.sleep(nanoseconds: 1_000_000)
    }
    try autoreleasepool {
        guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: file) as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw RenderError.image(file) }
        var pixel: CVPixelBuffer?
        guard let pool = adaptor.pixelBufferPool,
              CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pixel) == kCVReturnSuccess,
              let buffer = pixel else { throw RenderError.writer("pixelBuffer") }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: manifest.width, height: manifest.height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue) else { throw RenderError.writer("CGContext") }
        context.draw(image, in: CGRect(x: 0, y: 0, width: manifest.width, height: manifest.height))
        guard adaptor.append(buffer, withPresentationTime: CMTime(seconds: seconds, preferredTimescale: 60_000)) else { throw RenderError.writer(writer.error?.localizedDescription ?? "append") }
    }
}
try await append(manifest.clips[0].frames[0].file, at: 0)
var previous = 0.0
var count = 1
for clip in manifest.clips {
    for frame in clip.frames {
        let seconds = clip.start + min(1, frame.at / clip.rawDuration) * clip.duration
        if seconds <= previous { continue }
        try await append(frame.file, at: seconds)
        previous = seconds
        count += 1
    }
}
// 종료 구간도 30fps 표본으로 채워 마지막 긴 표본 때문에 브라우저의 반복이 지연되지 않게 한다.
for index in 0..<180 {
    let seconds = 54 + Double(index) / 30
    if seconds > previous { try await append(last.frames.last!.file, at: seconds) }
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
print("Rendered actual-page footage; \(duration)s; no audio; \(destination.path)")
