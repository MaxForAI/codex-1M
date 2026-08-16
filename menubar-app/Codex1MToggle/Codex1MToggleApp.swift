import AppKit
import SwiftUI

@main
struct Codex1MToggleApp: App {
    @StateObject private var controller = ToggleController()

    var body: some Scene {
        MenuBarExtra {
            Text(controller.status.label)
            Divider()
            Button("Enable globally") { controller.run("on") }
                .disabled(controller.isRunning)
            Button("Disable globally") { controller.run("off") }
                .disabled(controller.isRunning)
            Button("Refresh status") { controller.refresh() }
                .disabled(controller.isRunning)
            Divider()
            Text("Changes apply to new Codex sessions.")
                .font(.caption)
            Button("Quit") { NSApplication.shared.terminate(nil) }
        } label: {
            Text(controller.status.menuTitle)
                .help(controller.status.label)
        }
        .menuBarExtraStyle(.menu)
    }
}

@MainActor
final class ToggleController: ObservableObject {
    enum Status {
        case checking
        case enabled
        case disabled
        case failed(String)

        var menuTitle: String {
            switch self {
            case .checking: return "1M …"
            case .enabled: return "1M ✓"
            case .disabled: return "1M –"
            case .failed: return "1M !"
            }
        }

        var label: String {
            switch self {
            case .checking: return "Checking 1M context status…"
            case .enabled: return "1M context is enabled globally"
            case .disabled: return "1M context is not enabled globally"
            case .failed(let message): return "Status unavailable: \(message)"
            }
        }
    }

    @Published private(set) var status: Status = .checking
    @Published private(set) var isRunning = false
    private let helper = HelperCommand()

    init() {
        refresh()
    }

    func refresh() {
        execute("status")
    }

    func run(_ action: String) {
        execute(action)
    }

    private func execute(_ action: String) {
        guard !isRunning else { return }
        isRunning = true

        Task {
            let result = await Task.detached(priority: .userInitiated) { [helper] in
                helper.run(action)
            }.value

            isRunning = false
            if result.exitCode != 0 {
                status = .failed(result.output)
                return
            }

            if action == "status" {
                status = result.output.contains("1M Enabled: Yes") ? .enabled : .disabled
            } else {
                status = action == "on" ? .enabled : .disabled
            }
        }
    }
}

struct CommandResult: Sendable {
    let exitCode: Int32
    let output: String
}

struct HelperCommand: Sendable {
    func run(_ action: String) -> CommandResult {
        guard ["on", "off", "status"].contains(action) else {
            return CommandResult(exitCode: 64, output: "Unsupported action: \(action)")
        }
        guard let helperURL = locateHelper() else {
            return CommandResult(
                exitCode: 66,
                output: "Cannot find codex-1m-action. Set CODEX_1M_HELPER or install it in the app bundle."
            )
        }

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
            let output = String(decoding: data, as: UTF8.self)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return CommandResult(exitCode: process.terminationStatus, output: output)
        } catch {
            return CommandResult(exitCode: 70, output: error.localizedDescription)
        }
    }

    private func locateHelper() -> URL? {
        let environment = ProcessInfo.processInfo.environment
        let fileManager = FileManager.default
        var candidates: [URL] = []

        if let override = environment["CODEX_1M_HELPER"], !override.isEmpty {
            candidates.append(URL(fileURLWithPath: override))
        }
        if let resourceURL = Bundle.main.resourceURL {
            candidates.append(resourceURL.appendingPathComponent("codex-1m-action"))
        }
        candidates.append(
            fileManager.homeDirectoryForCurrentUser
                .appendingPathComponent("dev/codex-1m/scripts/codex-1m-action")
        )

        return candidates.first { fileManager.isExecutableFile(atPath: $0.path) }
    }
}
