// Part of Ramz (https://github.com/mrehan27/Ramz). Written by Claude.
// What macOS's window server thinks of Ramz's windows, which is not always what
// Electron thinks: a panel that survived a display reconnect reported itself
// visible to Electron while the window server kept it off screen. The panel is
// the 640x460 window at layer 1000.
//
//   swift scripts/window-server.swift
//
// Positions and flags only. No titles or contents, so it needs no screen
// recording permission and shows nothing private.
import CoreGraphics
import Foundation

var count: UInt32 = 0
CGGetActiveDisplayList(0, nil, &count)
var ids = [CGDirectDisplayID](repeating: 0, count: Int(count))
CGGetActiveDisplayList(count, &ids, &count)
for d in ids { let b = CGDisplayBounds(d); print("display \(d): \(Int(b.origin.x)),\(Int(b.origin.y)) \(Int(b.width))x\(Int(b.height))\(CGDisplayIsMain(d) != 0 ? " main" : "")") }
let all = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] ?? []
for w in all where (w[kCGWindowOwnerName as String] as? String) == "Ramz" {
  let b = w[kCGWindowBounds as String] as? [String: Double] ?? [:]
  let on = (w[kCGWindowIsOnscreen as String] as? Bool) ?? false
  let alpha = w[kCGWindowAlpha as String] as? Double ?? -1
  let layer = w[kCGWindowLayer as String] as? Int ?? -1
  let num = w[kCGWindowNumber as String] as? Int ?? -1
  print("window \(num): \(Int(b["X"] ?? 0)),\(Int(b["Y"] ?? 0)) \(Int(b["Width"] ?? 0))x\(Int(b["Height"] ?? 0)) onscreen=\(on) alpha=\(alpha) layer=\(layer)")
}
