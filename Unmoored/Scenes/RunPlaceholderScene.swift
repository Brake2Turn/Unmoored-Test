import SpriteKit

protocol RunPlaceholderSceneDelegate: AnyObject {
    func runScene(_ scene: RunPlaceholderScene, didExitWith run: RunState)
}

/// A stand-in for gameplay.
///
/// This exists purely so the start screen's three actions can be exercised
/// end-to-end: starting a run creates a save, time spent here accumulates, and
/// leaving writes it back so Continue Run has something real to resume. Replace
/// this wholesale when the actual game scene arrives.
final class RunPlaceholderScene: SKScene {

    weak var runDelegate: RunPlaceholderSceneDelegate?

    private var run: RunState
    private let headline = SKLabelNode()
    private let clock = SKLabelNode()
    private let hint = SKLabelNode()
    private let backButton: MenuButton

    private var lastUpdateTime: TimeInterval = 0
    private var trackedButton: MenuButton?

    var safeInsets: UIEdgeInsets = .zero {
        didSet {
            guard safeInsets != oldValue else { return }
            layoutContents()
        }
    }

    init(size: CGSize, run: RunState) {
        self.run = run
        self.backButton = MenuButton(identifier: "exit", title: "RETURN TO TITLE", style: .secondary)
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
        guard children.isEmpty else { return }

        [headline, clock, hint].forEach {
            $0.verticalAlignmentMode = .center
            $0.horizontalAlignmentMode = .center
            addChild($0)
        }

        backButton.onActivate = { [weak self] in
            guard let self else { return }
            RunStore.shared.save(self.run)
            self.runDelegate?.runScene(self, didExitWith: self.run)
        }
        addChild(backButton)

        layoutContents()
    }

    override func didChangeSize(_ oldSize: CGSize) {
        super.didChangeSize(oldSize)
        guard !children.isEmpty else { return }
        layoutContents()
    }

    override func update(_ currentTime: TimeInterval) {
        let delta = lastUpdateTime == 0 ? 0 : min(currentTime - lastUpdateTime, 1.0 / 20.0)
        lastUpdateTime = currentTime

        run.elapsed += delta
        refreshClock()
    }

    private func layoutContents() {
        let centreX = size.width / 2

        headline.attributedText = Theme.tracked("SECTOR \(run.sector)",
                                                font: Theme.Font.display,
                                                size: 44,
                                                color: Theme.Palette.textPrimary,
                                                kern: Theme.Kerning.display)
        headline.position = CGPoint(x: centreX, y: size.height * 0.58)

        hint.attributedText = Theme.tracked("GAMEPLAY GOES HERE",
                                            font: Theme.Font.body,
                                            size: 11,
                                            color: Theme.Palette.textMuted,
                                            kern: Theme.Kerning.caption)
        hint.position = CGPoint(x: centreX, y: size.height * 0.58 - 62)

        clock.position = CGPoint(x: centreX, y: size.height * 0.58 - 30)
        refreshClock()

        let available = size.width - (Theme.Layout.screenMargin * 2) - safeInsets.left - safeInsets.right
        backButton.baseScale = min(Theme.Layout.buttonWidth, available) / Theme.Layout.buttonWidth
        backButton.position = CGPoint(x: centreX, y: safeInsets.bottom + 96)
    }

    private func refreshClock() {
        let minutes = Int(run.elapsed) / 60
        let seconds = Int(run.elapsed) % 60
        clock.attributedText = Theme.tracked(String(format: "%d:%02d", minutes, seconds),
                                             font: Theme.Font.body,
                                             size: 15,
                                             color: Theme.Palette.accent,
                                             kern: Theme.Kerning.label)
    }

    // MARK: - Touch handling

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let point = touches.first?.location(in: self),
              backButton.contains(scenePoint: point) else { return }
        trackedButton = backButton
        backButton.setPressed(true)
        Haptics.tap()
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let point = touches.first?.location(in: self), let tracked = trackedButton else { return }
        tracked.setPressed(tracked.contains(scenePoint: point))
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let point = touches.first?.location(in: self), let tracked = trackedButton else { return }
        defer { trackedButton = nil }

        tracked.setPressed(false)
        guard tracked.contains(scenePoint: point) else { return }

        tracked.flash()
        Haptics.confirm()
        tracked.onActivate?()
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        trackedButton?.setPressed(false)
        trackedButton = nil
    }
}
