import SpriteKit

/// A single start-screen menu entry: a translucent capsule with a tracked
/// label, an optional caption underneath, a pressed state and a disabled state.
final class MenuButton: SKNode {

    enum Style {
        /// The one action we want the player's thumb to find first.
        case primary
        case secondary
    }

    let identifier: String
    private let style: Style
    private let size: CGSize

    private let background = SKShapeNode()
    private let bloom = SKShapeNode()
    private let titleLabel = SKLabelNode()
    private let captionLabel = SKLabelNode()

    private var title: String
    private var caption: String?

    /// Fired on a tap that both begins and ends inside the button.
    var onActivate: (() -> Void)?

    private(set) var isEnabled: Bool = true
    private(set) var isPressed: Bool = false

    /// Layout scale set by the scene to fit narrow screens. Press feedback
    /// multiplies this rather than replacing it, so a scaled button does not
    /// snap back to full size the moment it is touched.
    var baseScale: CGFloat = 1 {
        didSet {
            guard baseScale != oldValue else { return }
            setScale(isPressed ? baseScale * Self.pressedScale : baseScale)
        }
    }

    private static let pressedScale: CGFloat = 0.972

    init(identifier: String,
         title: String,
         caption: String? = nil,
         style: Style = .secondary,
         size: CGSize = CGSize(width: Theme.Layout.buttonWidth, height: Theme.Layout.buttonHeight)) {
        self.identifier = identifier
        self.title = title
        self.caption = caption
        self.style = style
        self.size = size
        super.init()

        isUserInteractionEnabled = false
        buildNodes()
        applyAppearance(animated: false)
    }

    @available(*, unavailable)
    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // MARK: - Configuration

    func setEnabled(_ enabled: Bool) {
        guard isEnabled != enabled else { return }
        isEnabled = enabled
        if !enabled { isPressed = false }
        applyAppearance(animated: true)
    }

    /// Updates the title and caption in place — used when a saved run appears
    /// or is cleared and the Continue entry has to relabel itself.
    func update(title: String, caption: String?) {
        self.title = title
        self.caption = caption
        applyAppearance(animated: false)
    }

    // MARK: - Interaction (driven by the scene)

    func setPressed(_ pressed: Bool) {
        guard isEnabled, isPressed != pressed else { return }
        isPressed = pressed

        removeAction(forKey: "press")
        let scale = SKAction.scale(to: pressed ? baseScale * Self.pressedScale : baseScale, duration: 0.09)
        scale.timingMode = .easeOut
        run(scale, withKey: "press")

        bloom.removeAllActions()
        bloom.run(SKAction.fadeAlpha(to: pressed ? 0.55 : 0, duration: 0.09))
    }

    /// The confirming flash when a press is released on target.
    func flash() {
        bloom.removeAllActions()
        bloom.alpha = 0.75
        bloom.run(SKAction.fadeAlpha(to: 0, duration: 0.28))
    }

    /// Generous touch target — the visible capsule plus a little slack, so a
    /// thumb that lands just off the edge still counts.
    func contains(scenePoint: CGPoint) -> Bool {
        let local = convert(scenePoint, from: scene ?? self)
        let target = CGRect(x: -size.width / 2 - 8,
                            y: -size.height / 2 - 6,
                            width: size.width + 16,
                            height: size.height + 12)
        return target.contains(local)
    }

    // MARK: - Private

    private func buildNodes() {
        let rect = CGRect(x: -size.width / 2, y: -size.height / 2,
                          width: size.width, height: size.height)
        let path = CGPath(roundedRect: rect,
                          cornerWidth: Theme.Layout.buttonCornerRadius,
                          cornerHeight: Theme.Layout.buttonCornerRadius,
                          transform: nil)

        bloom.path = path
        bloom.fillColor = Theme.Palette.accent
        bloom.strokeColor = .clear
        bloom.alpha = 0
        bloom.blendMode = .add
        bloom.zPosition = 0
        addChild(bloom)

        background.path = path
        background.lineWidth = 1.2
        background.zPosition = 1
        addChild(background)

        titleLabel.verticalAlignmentMode = .center
        titleLabel.horizontalAlignmentMode = .center
        titleLabel.zPosition = 2
        addChild(titleLabel)

        captionLabel.verticalAlignmentMode = .center
        captionLabel.horizontalAlignmentMode = .center
        captionLabel.zPosition = 2
        addChild(captionLabel)
    }

    private func applyAppearance(animated: Bool) {
        let hasCaption = !(caption?.isEmpty ?? true)

        // With a caption the title lifts so the pair sits optically centred.
        titleLabel.position = CGPoint(x: 0, y: hasCaption ? 9 : 0)
        captionLabel.position = CGPoint(x: 0, y: -13)
        captionLabel.isHidden = !hasCaption

        let titleColor: SKColor
        let captionColor: SKColor
        let fill: SKColor
        let stroke: SKColor

        switch (isEnabled, style) {
        case (false, _):
            titleColor = Theme.Palette.textDisabled
            captionColor = Theme.Palette.textDisabled
            fill = SKColor.white.withAlphaComponent(0.02)
            stroke = SKColor.white.withAlphaComponent(0.07)
        case (true, .primary):
            titleColor = Theme.Palette.void
            captionColor = Theme.Palette.void
            fill = Theme.Palette.accent.withAlphaComponent(0.92)
            stroke = Theme.Palette.accent
        case (true, .secondary):
            titleColor = Theme.Palette.textPrimary
            captionColor = Theme.Palette.textMuted
            fill = SKColor.white.withAlphaComponent(0.05)
            stroke = Theme.Palette.accentDim.withAlphaComponent(0.85)
        }

        background.fillColor = fill
        background.strokeColor = stroke
        background.glowWidth = (isEnabled && style == .primary) ? 2.5 : 0

        titleLabel.attributedText = Theme.tracked(title,
                                                  font: Theme.Font.bodyBold,
                                                  size: 17,
                                                  color: titleColor,
                                                  kern: Theme.Kerning.label)

        if let caption, !caption.isEmpty {
            captionLabel.attributedText = Theme.tracked(caption,
                                                        font: Theme.Font.body,
                                                        size: 10,
                                                        color: captionColor,
                                                        kern: Theme.Kerning.caption)
        }

        alpha = isEnabled ? 1.0 : 0.55
    }
}
