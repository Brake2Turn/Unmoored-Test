import Foundation

/// A single in-progress run. This is deliberately small for now — it exists so
/// the start screen has something real to save, resume and describe. Gameplay
/// fields get added here as the game itself grows.
struct RunState: Codable, Equatable {

    let id: UUID
    let startedAt: Date
    var lastPlayedAt: Date

    /// How far the ship has drifted. Doubles as the run's headline progress.
    var sector: Int
    /// Seconds of play accumulated across all sessions of this run.
    var elapsed: TimeInterval
    var hullIntegrity: Double

    init(id: UUID = UUID(),
         startedAt: Date = Date(),
         lastPlayedAt: Date = Date(),
         sector: Int = 1,
         elapsed: TimeInterval = 0,
         hullIntegrity: Double = 1.0) {
        self.id = id
        self.startedAt = startedAt
        self.lastPlayedAt = lastPlayedAt
        self.sector = sector
        self.elapsed = elapsed
        self.hullIntegrity = hullIntegrity
    }

    /// One-line description shown under the Continue Run button, e.g.
    /// "SECTOR 3 · 12:40 · HULL 84%".
    var summary: String {
        let minutes = Int(elapsed) / 60
        let seconds = Int(elapsed) % 60
        let clock = String(format: "%d:%02d", minutes, seconds)
        let hull = Int((hullIntegrity * 100).rounded())
        return "SECTOR \(sector) · \(clock) · HULL \(hull)%"
    }
}
