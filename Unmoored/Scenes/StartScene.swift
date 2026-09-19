import SpriteKit
import UIKit

protocol StartSceneDelegate: AnyObject {
    func startSceneDidSelectNewRun(_ scene: StartScene)
    func startSceneDidSelectContinueRun(_ scene: StartScene)
    func startSceneDidSelectSettings(_ scene: StartScene)
}

/// The title screen: drifting starfield, the game's wordmark, and the three
/// menu entries.
final class StartScene: SKScene {

    weak var menuDelegate: StartSceneDelegate?

    /// Safe-area padding handed down from SwiftUI so the layout clears the
    /// notch and the home indicator.
    var safeInsets: UIEdgeInsets = .zero {
        didSet {
            guard safeInsets != oldValue else { return }
            layoutContents()
        }
    }

    var reduceMotion: Bool = false {
        didSet {
            guard reduceMotion != oldValue else { return }
            rebuildBackground()
        }
    }

    // MARK: - Nodes

    private let backdrop = CelestialBackdrop()
    private let starfield = Starfield()
    private let titleNode = SKNode()
    private let menuNode = SKNode()

    private let titleLabel = SKLabelNode()
    private let subtitleLabel = SKLabelNode()
    private let rule = SKShapeNode()
    private let versionLabel = SKLabelNode()

    private var buttons: [MenuButton] = []
    private var newRunButton: MenuButton!
    private var continueButton: MenuButton!
    private var settingsButton: MenuButton!

    // MARK: - State

    private var lastUpdateTime: TimeInterval = 0
    private var trackedButton: MenuButton?
    private var hasPresented = false

    // MARK: - Lifecycle

    override init(size: CGSize) {
        super.init(size: size)
        scaleMode = .resizeFill
        anchorPoint = .zero
        backgroundColor = Theme.Palette.void
    }

    @available(*, unavailable)
    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func didMove(to view: SKView) {
        super.didMove(to: view)

        if children.isEmpty {
            buildHierarchy()
        }

        rebuildBackground()
        layoutContents()
        refreshContinueState()

        // Only play the entrance the first time the screen appears; coming back
        // from a run should feel like a return, not a fresh launch.
        if !hasPresented {
            hasPresented = true
            runEntranceAnimation()
        }

        Haptics.prepare()
    }

    override func didChangeSize(_ oldSize: CGSize) {
        super.didChangeSize(oldSize)
        guard !children.isEmpty, size != oldSize else { return }
        rebuildBackground()
        layoutContents()
    }

    override func update(_ currentTime: TimeInterval) {
        // First frame after a resume can carry a huge gap; clamp it so the
        // starfield never jumps.
        let delta = lastUpdateTime == 0 ? 0 : min(currentTime - lastUpdateTime, 1.0 / 20.0)
        lastUpdateTime = currentTime
        starfield.update(deltaTime: delta)
    }

    // MARK: - Public

    /// Re-reads the saved run and relabels the Continue entry. Call whenever
    /// the screen comes back to the front.
    func refreshContinueState() {
        let run = RunStore.shared.current

        if let run {
            continueButton.update(title: "CONTINUE RUN", caption: run.summary)
            continueButton.setEnabled(true)
        } else {
            continueButton.update(title: "CONTINUE RUN", caption: "NO RUN IN PROGRESS")
            continueButton.setEnabled(false)
        }
    }

    // MARK: - Build

    private func buildHierarchy() {
        backdrop.zPosition = 0
        starfield.zPosition = 1
        titleNode.zPosition = 10
        menuNode.zPosition = 10

        addChild(backdrop)
        addChild(starfield)
        addChild(titleNode)
        addChild(menuNode)

        // Title block
        titleLabel.verticalAlignmentMode = .center
        titleLabel.horizontalAlignmentMode = .center
        titleNode.addChild(titleLabel)

        rule.strokeColor = Theme.Palette.accent.withAlphaComponent(0.45)
        rule.lineWidth = 1
        titleNode.addChild(rule)

        subtitleLabel.verticalAlignmentMode = .center
        subtitleLabel.horizontalAlignmentMode = .center
        titleNode.addChild(subtitleLabel)

        // Menu
        newRunButton = MenuButton(identifier: "newRun", title: "NEW RUN", style: .primary)
        newRunButton.onActivate = { [weak self] in
            guard let self else { return }
            self.menuDelegate?.startSceneDidSelectNewRun(self)
        }

        continueButton = MenuButton(identifier: "continueRun",
                                    title: "CONTINUE RUN",
                                    caption: "NO RUN IN PROGRESS",
                                    style: .secondary)
        continueButton.onActivate = { [weak self] in
            guard let self else { return }
            self.menuDelegate?.startSceneDidSelectContinueRun(self)
        }

        settingsButton = MenuButton(identifier: "settings", title: "SETTINGS", style: .secondary)
        settingsButton.onActivate = { [weak self] in
            guard let self else { return }
            self.menuDelegate?.startSceneDidSelectSettings(self)
        }

        buttons = [newRunButton, continueButton, settingsButton]
        buttons.forEach { menuNode.addChild($0) }

        versionLabel.verticalAlignmentMode = .center
        versionLabel.horizontalAlignmentMode = .center
        versionLabel.zPosition = 10
        addChild(versionLabel)
    }

    private func rebuildBackground() {
        guard size.width > 0, size.height > 0 else { return }
        backdrop.build(size: size, reduceMotion: reduceMotion)
        starfield.build(size: size, reduceMotion: reduceMotion)
    }

    // MARK: - Layout

    private func layoutContents() {
        guard size.width > 0, size.height > 0 else { return }

        let centreX = size.width / 2
        let topInset = safeInsets.top
        let bottomInset = safeInsets.bottom

        // Buttons shrink a little on narrow phones so the margins stay honest.
        let available = size.width - (Theme.Layout.screenMargin * 2) - safeInsets.left - safeInsets.right
        let buttonWidth = min(Theme.Layout.buttonWidth, available)

        // --- Menu: anchored to the lower third ---
        let step = Theme.Layout.buttonHeight + Theme.Layout.buttonSpacing
        let menuBottom = bottomInset + 96
        for (index, button) in buttons.enumerated() {
            let y = menuBottom + CGFloat(buttons.count - 1 - index) * step
            button.position = CGPoint(x: centreX, y: y)
            button.baseScale = buttonWidth / Theme.Layout.buttonWidth
        }

        let menuTop = menuBottom + CGFloat(buttons.count - 1) * step + Theme.Layout.buttonHeight / 2

        // --- Title: centred in the space above the menu ---
        let titleSize = min(max(size.width * 0.155, 40), 72)
        titleLabel.attributedText = Theme.tracked("UNMOORED",
                                                  font: Theme.Font.display,
                                                  size: titleSize,
                                                  color: Theme.Palette.textPrimary,
                                                  kern: Theme.Kerning.display)

        subtitleLabel.attributedText = Theme.tracked("A DRIFT THROUGH THE QUIET DARK",
                                                     font: Theme.Font.body,
                                                     size: 11,
                                                     color: Theme.Palette.textMuted,
                                                     kern: Theme.Kerning.caption)

        let ruleWidth = min(buttonWidth * 0.62, size.width * 0.5)
        let rulePath = CGMutablePath()
        rulePath.move(to: CGPoint(x: -ruleWidth / 2, y: 0))
        rulePath.addLine(to: CGPoint(x: ruleWidth / 2, y: 0))
        rule.path = rulePath

        titleLabel.position = .zero
        rule.position = CGPoint(x: 0, y: -titleSize * 0.62)
        subtitleLabel.position = CGPoint(x: 0, y: -titleSize * 0.62 - 20)

        // Sit the block in the middle of the gap between the top inset and the
        // menu, then nudge it up slightly — optically centred beats measured.
        let headroomTop = size.height - topInset
        let blockCentre = menuTop + (headroomTop - menuTop) / 2 + titleSize * 0.18
        titleNode.position = CGPoint(x: centreX, y: blockCentre)

        versionLabel.attributedText = Theme.tracked(Self.versionString,
                                                    font: Theme.Font.body,
                                                    size: 9,
                                                    color: Theme.Palette.textDisabled,
                                                    kern: Theme.Kerning.caption)
        versionLabel.position = CGPoint(x: centreX, y: bottomInset + 34)
    }

    private static var versionString: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "0.1"
        let build = info?["CFBundleVersion"] as? String ?? "1"
        return "V\(version) (\(build))"
    }

    // MARK: - Entrance

    private func runEntranceAnimation() {
        guard !reduceMotion else {
            titleNode.alpha = 1
            buttons.forEach { $0.alpha = $0.isEnabled ? 1 : 0.55 }
            versionLabel.alpha = 1
            return
        }

        titleNode.alpha = 0
        titleNode.setScale(0.96)
        versionLabel.alpha = 0

        let titleFade = SKAction.fadeIn(withDuration: 1.1)
        let titleScale = SKAction.scale(to: 1.0, duration: 1.1)
        titleScale.timingMode = .easeOut
        titleFade.timingMode = .easeOut
        titleNode.run(SKAction.sequence([
            SKAction.wait(forDuration: 0.25),
            SKAction.group([titleFade, titleScale])
        ]))

        // Menu entries rise in sequence beneath the title.
        for (index, button) in buttons.enumerated() {
            let target = button.alpha
            let home = button.position
            button.alpha = 0
            button.position = CGPoint(x: home.x, y: home.y - 14)

            let rise = SKAction.move(to: home, duration: 0.5)
            rise.timingMode = .easeOut

            button.run(SKAction.sequence([
                SKAction.wait(forDuration: 0.85 + Double(index) * 0.11),
                SKAction.group([SKAction.fadeAlpha(to: target, duration: 0.5), rise])
            ]))
        }

        versionLabel.run(SKAction.sequence([
            SKAction.wait(forDuration: 1.4),
            SKAction.fadeIn(withDuration: 0.6)
        ]))
    }

    // MARK: - Touch handling

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let point = touches.first?.location(in: self) else { return }
        guard let button = button(at: point) else { return }

        trackedButton = button
        button.setPressed(true)
        Haptics.tap()
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let point = touches.first?.location(in: self), let tracked = trackedButton else { return }
        // Dragging off the button cancels the press, the way UIKit controls do.
        tracked.setPressed(tracked.contains(scenePoint: point))
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let point = touches.first?.location(in: self), let tracked = trackedButton else { return }
        defer { trackedButton = nil }

        tracked.setPressed(false)
        guard tracked.isEnabled, tracked.contains(scenePoint: point) else { return }

        tracked.flash()
        Haptics.confirm()
        tracked.onActivate?()
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        trackedButton?.setPressed(false)
        trackedButton = nil
    }

    /// Topmost enabled button whose (padded) target contains the point.
    private func button(at point: CGPoint) -> MenuButton? {
        buttons.first { $0.isEnabled && $0.contains(scenePoint: point) }
    }
}
