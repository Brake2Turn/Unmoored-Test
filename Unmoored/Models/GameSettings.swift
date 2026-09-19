import Combine
import Foundation

/// Player preferences, persisted to `UserDefaults` on every change.
final class GameSettings: ObservableObject {

    private enum Key {
        static let music = "settings.musicVolume"
        static let effects = "settings.effectsVolume"
        static let haptics = "settings.hapticsEnabled"
        static let reduceMotion = "settings.reduceMotion"
    }

    private let defaults: UserDefaults

    @Published var musicVolume: Double { didSet { defaults.set(musicVolume, forKey: Key.music) } }
    @Published var effectsVolume: Double { didSet { defaults.set(effectsVolume, forKey: Key.effects) } }

    @Published var hapticsEnabled: Bool {
        didSet {
            defaults.set(hapticsEnabled, forKey: Key.haptics)
            Haptics.isEnabled = hapticsEnabled
        }
    }

    /// Calms the starfield drift and parallax for players sensitive to motion.
    @Published var reduceMotion: Bool { didSet { defaults.set(reduceMotion, forKey: Key.reduceMotion) } }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults

        defaults.register(defaults: [
            Key.music: 0.7,
            Key.effects: 0.85,
            Key.haptics: true,
            Key.reduceMotion: false
        ])

        self.musicVolume = defaults.double(forKey: Key.music)
        self.effectsVolume = defaults.double(forKey: Key.effects)
        self.hapticsEnabled = defaults.bool(forKey: Key.haptics)
        self.reduceMotion = defaults.bool(forKey: Key.reduceMotion)

        Haptics.isEnabled = self.hapticsEnabled
    }
}
