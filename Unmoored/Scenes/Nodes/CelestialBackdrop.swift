import SpriteKit

/// Everything behind the starfield: the sky gradient, two nebula blooms, a
/// drifting planet on the horizon, and the occasional shooting star.
final class CelestialBackdrop: SKNode {

    private var shootingStarTimer: SKAction?
    private var sceneSize: CGSize = .zero
    private var reduceMotion = false

    func build(size: CGSize, reduceMotion: Bool) {
        removeAllChildren()
        removeAllActions()
        sceneSize = size
        self.reduceMotion = reduceMotion

        guard size.width > 0, size.height > 0 else { return }

        addSky(size: size)
        addNebulae(size: size, reduceMotion: reduceMotion)
        addPlanet(size: size, reduceMotion: reduceMotion)

        if !reduceMotion {
            scheduleShootingStars(size: size)
        }
    }

    // MARK: - Private

    private func addSky(size: CGSize) {
        let sky = SKSpriteNode(texture: TextureFactory.verticalGradient(
            size: CGSize(width: 4, height: 256),
            top: Theme.Palette.horizon,
            bottom: Theme.Palette.void
        ))
        sky.size = size
        sky.position = CGPoint(x: size.width / 2, y: size.height / 2)
        sky.zPosition = -10
        addChild(sky)
    }

    private func addNebulae(size: CGSize, reduceMotion: Bool) {
        let specs: [(color: SKColor, centre: CGPoint, scale: CGFloat, alpha: CGFloat)] = [
            (Theme.Palette.nebulaViolet,
             CGPoint(x: size.width * 0.22, y: size.height * 0.74),
             size.width * 1.15 / 256, 0.32),
            (Theme.Palette.nebulaTeal,
             CGPoint(x: size.width * 0.86, y: size.height * 0.38),
             size.width * 0.95 / 256, 0.24)
        ]

        for (index, spec) in specs.enumerated() {
            let cloud = SKSpriteNode(texture: TextureFactory.glow(diameter: 256, color: spec.color))
            cloud.setScale(spec.scale)
            cloud.position = spec.centre
            cloud.alpha = spec.alpha
            cloud.blendMode = .add
            cloud.zPosition = -9
            addChild(cloud)

            guard !reduceMotion else { continue }

            // A slow, offset breath keeps the clouds from feeling like static
            // wallpaper without ever drawing attention to itself.
            let duration = 14.0 + Double(index) * 5
            let expand = SKAction.scale(to: spec.scale * 1.08, duration: duration)
            let settle = SKAction.scale(to: spec.scale, duration: duration)
            expand.timingMode = .easeInEaseOut
            settle.timingMode = .easeInEaseOut
            cloud.run(SKAction.repeatForever(SKAction.sequence([expand, settle])))
        }
    }

    private func addPlanet(size: CGSize, reduceMotion: Bool) {
        let diameter = size.width * 0.86
        let planet = SKSpriteNode(texture: TextureFactory.planet(
            diameter: 512,
            light: Theme.Palette.planetLight,
            dark: Theme.Palette.planetDark
        ))
        planet.size = CGSize(width: diameter, height: diameter)
        // Sits mostly below the lower edge, so only its lit crown shows.
        planet.position = CGPoint(x: size.width * 0.5, y: -diameter * 0.34)
        planet.zPosition = -8
        addChild(planet)

        // A thin rim of atmosphere catching the same off-screen light.
        let rim = SKShapeNode(circleOfRadius: diameter / 2)
        rim.fillColor = .clear
        rim.strokeColor = Theme.Palette.accent.withAlphaComponent(0.30)
        rim.lineWidth = 1.5
        rim.glowWidth = 6
        rim.position = planet.position
        rim.zPosition = -7
        addChild(rim)

        guard !reduceMotion else { return }

        let rise = SKAction.moveBy(x: 0, y: 10, duration: 11)
        let fall = SKAction.moveBy(x: 0, y: -10, duration: 11)
        rise.timingMode = .easeInEaseOut
        fall.timingMode = .easeInEaseOut
        let bob = SKAction.repeatForever(SKAction.sequence([rise, fall]))
        planet.run(bob)
        rim.run(bob)
    }

    private func scheduleShootingStars(size: CGSize) {
        let spawn = SKAction.run { [weak self] in self?.launchShootingStar(size: size) }
        let wait = SKAction.wait(forDuration: 7, withRange: 9)
        run(SKAction.repeatForever(SKAction.sequence([wait, spawn])), withKey: "shootingStars")
    }

    private func launchShootingStar(size: CGSize) {
        let streak = SKSpriteNode(texture: TextureFactory.star(diameter: 24, color: Theme.Palette.star))
        streak.size = CGSize(width: 46, height: 3)
        streak.alpha = 0
        streak.blendMode = .add
        streak.zPosition = -6

        let startX = CGFloat.random(in: size.width * 0.1...size.width * 0.9)
        let startY = CGFloat.random(in: size.height * 0.55...size.height * 0.92)
        streak.position = CGPoint(x: startX, y: startY)
        streak.zRotation = -.pi / 7
        addChild(streak)

        let travel = SKAction.moveBy(x: 190, y: -95, duration: 0.85)
        travel.timingMode = .easeIn

        streak.run(SKAction.sequence([
            SKAction.group([
                travel,
                SKAction.sequence([
                    SKAction.fadeAlpha(to: 0.9, duration: 0.18),
                    SKAction.wait(forDuration: 0.30),
                    SKAction.fadeAlpha(to: 0, duration: 0.37)
                ])
            ]),
            SKAction.removeFromParent()
        ]))
    }
}
