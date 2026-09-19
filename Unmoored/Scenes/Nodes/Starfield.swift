import SpriteKit

/// A looping, multi-layer parallax starfield.
///
/// Each layer is a tile of randomly scattered stars, duplicated once and
/// stacked vertically. The pair scrolls as a unit and snaps back by exactly one
/// tile height when it has travelled that far, so the loop is seamless.
final class Starfield: SKNode {

    private struct Layer {
        let container: SKNode
        let speed: CGFloat
        let tileHeight: CGFloat
    }

    private var layers: [Layer] = []
    private var reduceMotion = false

    /// Depth bands: far stars are small, dim and slow; near stars are larger,
    /// brighter and drift noticeably faster.
    private struct Band {
        let count: Int
        let sizeRange: ClosedRange<CGFloat>
        let alphaRange: ClosedRange<CGFloat>
        let speed: CGFloat
        let twinkleChance: Double
    }

    private static let bands: [Band] = [
        Band(count: 110, sizeRange: 1.0...2.0, alphaRange: 0.25...0.50, speed: 4, twinkleChance: 0.10),
        Band(count: 60, sizeRange: 1.8...3.2, alphaRange: 0.45...0.75, speed: 9, twinkleChance: 0.25),
        Band(count: 26, sizeRange: 3.0...5.0, alphaRange: 0.70...1.00, speed: 17, twinkleChance: 0.45)
    ]

    /// Rebuilds the field for a new scene size. Safe to call on every rotation.
    func build(size: CGSize, reduceMotion: Bool) {
        removeAllChildren()
        layers.removeAll()
        self.reduceMotion = reduceMotion

        guard size.width > 0, size.height > 0 else { return }

        for band in Self.bands {
            let container = SKNode()
            let tile = makeTile(band: band, size: size)

            let lower = tile
            let upper = tile.copy() as! SKNode
            upper.position = CGPoint(x: 0, y: size.height)

            container.addChild(lower)
            container.addChild(upper)
            addChild(container)

            // Twinkle is applied after copying so the two tiles shimmer
            // independently instead of pulsing in lockstep.
            if !reduceMotion {
                applyTwinkle(to: lower, chance: band.twinkleChance)
                applyTwinkle(to: upper, chance: band.twinkleChance)
            }

            layers.append(Layer(container: container, speed: band.speed, tileHeight: size.height))
        }
    }

    /// Advances the drift. Called once per frame from the scene.
    func update(deltaTime: TimeInterval) {
        guard !reduceMotion else { return }

        for layer in layers {
            layer.container.position.y -= layer.speed * CGFloat(deltaTime)
            if layer.container.position.y <= -layer.tileHeight {
                layer.container.position.y += layer.tileHeight
            }
        }
    }

    // MARK: - Private

    private func makeTile(band: Band, size: CGSize) -> SKNode {
        let tile = SKNode()

        for _ in 0..<band.count {
            let diameter = CGFloat.random(in: band.sizeRange)
            let tint = Self.randomTint()
            let star = SKSpriteNode(texture: TextureFactory.star(diameter: 24, color: tint))
            star.size = CGSize(width: diameter * 4, height: diameter * 4)
            star.alpha = CGFloat.random(in: band.alphaRange)
            star.blendMode = .add
            star.position = CGPoint(x: CGFloat.random(in: 0...size.width),
                                    y: CGFloat.random(in: 0...size.height))
            tile.addChild(star)
        }

        return tile
    }

    private func applyTwinkle(to tile: SKNode, chance: Double) {
        for star in tile.children {
            guard Double.random(in: 0...1) < chance else { continue }

            let base = star.alpha
            let duration = TimeInterval.random(in: 1.4...3.6)
            let dim = SKAction.fadeAlpha(to: base * 0.35, duration: duration)
            let lift = SKAction.fadeAlpha(to: base, duration: duration)
            dim.timingMode = .easeInEaseOut
            lift.timingMode = .easeInEaseOut

            let pulse = SKAction.repeatForever(SKAction.sequence([dim, lift]))
            star.run(SKAction.sequence([
                SKAction.wait(forDuration: TimeInterval.random(in: 0...2.5)),
                pulse
            ]))
        }
    }

    /// Most stars are near-white; a few lean warm or cool so the field has
    /// some colour variation under close inspection.
    private static func randomTint() -> SKColor {
        switch Int.random(in: 0..<10) {
        case 0, 1: return Theme.Palette.starCool
        case 2: return Theme.Palette.starWarm
        default: return Theme.Palette.star
        }
    }
}
