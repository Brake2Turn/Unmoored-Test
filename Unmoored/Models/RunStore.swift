import Foundation

/// Reads and writes the single saved run.
///
/// The run is stored as JSON in Application Support rather than in
/// `UserDefaults`, because a run will grow well past the size defaults are
/// meant for once gameplay lands.
final class RunStore {

    static let shared = RunStore()

    private let fileURL: URL
    private let queue = DispatchQueue(label: "com.unmoored.runstore")

    /// Cached in memory so the start screen can ask `hasSavedRun` every frame
    /// without touching the disk.
    private(set) var current: RunState?

    init(filename: String = "current-run.json") {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let directory = base.appendingPathComponent("Unmoored", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        self.fileURL = directory.appendingPathComponent(filename)
        self.current = Self.read(from: fileURL)
    }

    var hasSavedRun: Bool { current != nil }

    /// Discards any existing run and begins a fresh one.
    @discardableResult
    func startNewRun() -> RunState {
        let run = RunState()
        save(run)
        return run
    }

    func save(_ run: RunState) {
        var updated = run
        updated.lastPlayedAt = Date()
        current = updated

        let url = fileURL
        queue.async {
            guard let data = try? JSONEncoder().encode(updated) else { return }
            try? data.write(to: url, options: .atomic)
        }
    }

    func clear() {
        current = nil
        let url = fileURL
        queue.async {
            try? FileManager.default.removeItem(at: url)
        }
    }

    private static func read(from url: URL) -> RunState? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(RunState.self, from: data)
    }
}
