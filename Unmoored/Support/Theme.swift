import SpriteKit
import SwiftUI
import UIKit

/// Central palette and type scale for the game. Every colour and font in the
/// app funnels through here so the look can be retuned in one place.
enum Theme {

    // MARK: - Palette

    enum Palette {
        /// Bottom of the background gradient — the deep, empty dark.
        static let void = SKColor(red: 0.020, green: 0.027, blue: 0.059, alpha: 1)
        /// Top of the background gradient — a slightly lifted midnight blue.
        static let horizon = SKColor(red: 0.039, green: 0.063, blue: 0.141, alpha: 1)

        static let nebulaViolet = SKColor(red: 0.380, green: 0.271, blue: 0.663, alpha: 1)
        static let nebulaTeal = SKColor(red: 0.118, green: 0.463, blue: 0.549, alpha: 1)

        static let star = SKColor(red: 0.910, green: 0.933, blue: 1.000, alpha: 1)
        static let starWarm = SKColor(red: 1.000, green: 0.886, blue: 0.784, alpha: 1)
        static let starCool = SKColor(red: 0.729, green: 0.859, blue: 1.000, alpha: 1)

        /// Primary interactive accent.
        static let accent = SKColor(red: 0.373, green: 0.851, blue: 0.910, alpha: 1)
        static let accentDim = SKColor(red: 0.220, green: 0.494, blue: 0.541, alpha: 1)

        static let textPrimary = SKColor(red: 0.863, green: 0.902, blue: 1.000, alpha: 1)
        static let textMuted = SKColor(red: 0.478, green: 0.529, blue: 0.659, alpha: 1)
        static let textDisabled = SKColor(red: 0.322, green: 0.361, blue: 0.459, alpha: 1)

        static let planetLight = SKColor(red: 0.243, green: 0.204, blue: 0.376, alpha: 1)
        static let planetDark = SKColor(red: 0.063, green: 0.055, blue: 0.129, alpha: 1)
    }

    // MARK: - Typography

    enum Font {
        static let display = "AvenirNextCondensed-Bold"
        static let body = "AvenirNext-Medium"
        static let bodyBold = "AvenirNext-DemiBold"
    }

    /// Tracking (letter spacing) used on the title and menu labels. Space games
    /// live or die on generous letter spacing.
    enum Kerning {
        static let display: CGFloat = 14
        static let label: CGFloat = 4
        static let caption: CGFloat = 2.5
    }

    // MARK: - Layout

    enum Layout {
        static let buttonWidth: CGFloat = 300
        static let buttonHeight: CGFloat = 64
        static let buttonSpacing: CGFloat = 16
        static let buttonCornerRadius: CGFloat = 14
        static let screenMargin: CGFloat = 24
    }

    // MARK: - SwiftUI bridge

    /// SwiftUI mirrors of the palette, for the settings sheet.
    enum UI {
        static let background = Color(red: 0.020, green: 0.027, blue: 0.059)
        static let surface = Color(red: 0.055, green: 0.078, blue: 0.157)
        static let accent = Color(red: 0.373, green: 0.851, blue: 0.910)
        static let textPrimary = Color(red: 0.863, green: 0.902, blue: 1.000)
        static let textMuted = Color(red: 0.478, green: 0.529, blue: 0.659)
    }

    // MARK: - Helpers

    /// Builds an attributed string with tracking applied, since `SKLabelNode`
    /// has no kerning property of its own.
    static func tracked(_ text: String,
                        font: String,
                        size: CGFloat,
                        color: SKColor,
                        kern: CGFloat) -> NSAttributedString {
        let resolved = UIFont(name: font, size: size) ?? UIFont.systemFont(ofSize: size, weight: .semibold)
        return NSAttributedString(string: text, attributes: [
            .font: resolved,
            .foregroundColor: color,
            .kern: kern
        ])
    }
}
