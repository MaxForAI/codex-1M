#!/usr/bin/env swift

// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Toggle Codex 1M Context
// @raycast.mode compact
// Optional parameters:
// @raycast.packageName codex-1m
// @raycast.icon 🧠
// @raycast.description Configure or remove global Codex 1M settings for new conversations

import Foundation

let allowedActions = ["toggle", "on", "off", "status"]
let requestedAction = CommandLine.arguments.dropFirst().first ?? "toggle"

guard allowedActions.contains(requestedAction) else {
    FileHandle.standardError.write(Data("Usage: Codex-1M-Toggle.swift [toggle|on|off|status]\n".utf8))
    exit(64)
}

let scriptURL = URL(fileURLWithPath: #filePath)
let helperURL = scriptURL
    .deletingLastPathComponent()
    .deletingLastPathComponent()
    .appendingPathComponent("scripts/codex-1m-action")

guard FileManager.default.isExecutableFile(atPath: helperURL.path) else {
    FileHandle.standardError.write(Data("Helper is not executable: \(helperURL.path)\n".utf8))
    exit(66)
}

func runHelper(_ action: String) -> (status: Int32, output: String) {
    let process = Process()
    process.executableURL = helperURL
    process.arguments = [action]
    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = pipe

    do {
        try process.run()
        process.waitUntilExit()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        return (
            process.terminationStatus,
            String(decoding: data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
        )
    } catch {
        return (70, error.localizedDescription)
    }
}

var action = requestedAction
if requestedAction == "toggle" {
    let status = runHelper("status")
    guard status.status == 0 else {
        FileHandle.standardError.write(Data("\(status.output)\n".utf8))
        exit(status.status)
    }
    action = status.output.contains("1M Configured: Yes") ? "off" : "on"
}

let result = runHelper(action)
print(result.output)
exit(result.status)
