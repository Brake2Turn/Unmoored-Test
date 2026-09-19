import UIKit

/// Thin wrapper over UIKit feedback so the scene never has to care whether the
/// player has haptics switched off.
enum Haptics {

    /// Set from `GameSettings` whenever the player toggles the preference.
    static var isEnabled = true

    private static let light = UIImpactFeedbackGenerator(style: .light)
    private static let medium = UIImpactFeedbackGenerator(style: .medium)

    /// Call before a likely tap so the Taptic Engine is warm and the hit lands
    /// without latency.
    static func prepare() {
        guard isEnabled else { return }
        light.prepare()
        medium.prepare()
    }

    static func tap() {
        guard isEnabled else { return }
        light.impactOccurred()
    }

    static func confirm() {
        guard isEnabled else { return }
        medium.impactOccurred()
    }
}
