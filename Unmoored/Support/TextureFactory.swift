import SpriteKit
import UIKit

/// Generates the handful of soft, round textures the start screen needs.
/// Drawing them at runtime keeps the app free of image assets and lets every
/// glow scale cleanly to any device size.
enum TextureFactory {

    private static var cache: [String: SKTexture] = [:]

    /// A soft point of light: bright core fading to nothing at the edge.
    static func star(diameter: CGFloat = 24, color: SKColor = Theme.Palette.star) -> SKTexture {
        radialGlow(diameter: diameter, color: color, coreStop: 0.12, key: "star")
    }

    /// A much wider, fainter glow used for nebulae and button bloom.
    static func glow(diameter: CGFloat = 256, color: SKColor) -> SKTexture {
        radialGlow(diameter: diameter, color: color, coreStop: 0.0, key: "glow")
    }

    /// Vertical two-stop gradient, used for the sky behind everything.
    static func verticalGradient(size: CGSize, top: SKColor, bottom: SKColor) -> SKTexture {
        let key = "grad-\(Int(size.width))x\(Int(size.height))-\(top.hashValue)-\(bottom.hashValue)"
        if let cached = cache[key] { return cached }

        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { context in
            let cg = context.cgContext
            let colors = [bottom.cgColor, top.cgColor] as CFArray
            guard let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                            colors: colors,
                                            locations: [0, 1]) else { return }
            cg.drawLinearGradient(gradient,
                                  start: CGPoint(x: 0, y: size.height),
                                  end: CGPoint(x: 0, y: 0),
                                  options: [])
        }

        let texture = SKTexture(image: image)
        cache[key] = texture
        return texture
    }

    /// A lit sphere: a radial gradient offset toward the upper-left so the
    /// planet reads as a solid body catching light from off-screen.
    static func planet(diameter: CGFloat, light: SKColor, dark: SKColor) -> SKTexture {
        let key = "planet-\(Int(diameter))"
        if let cached = cache[key] { return cached }

        let size = CGSize(width: diameter, height: diameter)
        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { context in
            let cg = context.cgContext
            let radius = diameter / 2

            cg.addEllipse(in: CGRect(origin: .zero, size: size))
            cg.clip()

            let colors = [light.cgColor, dark.cgColor] as CFArray
            guard let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                            colors: colors,
                                            locations: [0, 1]) else { return }

            // Light source sits up and to the left of the sphere's centre.
            let lightPoint = CGPoint(x: radius * 0.62, y: radius * 1.38)
            cg.drawRadialGradient(gradient,
                                  startCenter: lightPoint,
                                  startRadius: 0,
                                  endCenter: CGPoint(x: radius, y: radius),
                                  endRadius: radius * 1.35,
                                  options: [.drawsAfterEndLocation])
        }

        let texture = SKTexture(image: image)
        cache[key] = texture
        return texture
    }

    // MARK: - Private

    private static func radialGlow(diameter: CGFloat,
                                   color: SKColor,
                                   coreStop: CGFloat,
                                   key prefix: String) -> SKTexture {
        let key = "\(prefix)-\(Int(diameter))-\(color.hashValue)"
        if let cached = cache[key] { return cached }

        let size = CGSize(width: diameter, height: diameter)
        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { context in
            let cg = context.cgContext
            let radius = diameter / 2

            let colors = [
                color.withAlphaComponent(1).cgColor,
                color.withAlphaComponent(0.55).cgColor,
                color.withAlphaComponent(0).cgColor
            ] as CFArray

            guard let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                            colors: colors,
                                            locations: [coreStop, 0.4, 1]) else { return }

            cg.drawRadialGradient(gradient,
                                  startCenter: CGPoint(x: radius, y: radius),
                                  startRadius: 0,
                                  endCenter: CGPoint(x: radius, y: radius),
                                  endRadius: radius,
                                  options: [])
        }

        let texture = SKTexture(image: image)
        cache[key] = texture
        return texture
    }
}
