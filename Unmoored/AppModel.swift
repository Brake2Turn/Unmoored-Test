import Combine
import SpriteKit
import SwiftUI

/// Owns the long-lived scene and the app's navigation state, and acts as the
/// bridge between SpriteKit's delegate callbacks and SwiftUI's presentation.
final class AppModel: ObservableObject {

    let settings = GameSettings()
    let startScene: StartScene

    @Published var isShowingSettings = false

    private var cancellables: Set<AnyCancellable> = []

    /// The scene currently on screen. Once a run is presented the start scene's
    /// `view` is nil, so it cannot be used to reach the live scene.
    private weak var presentedScene: SKScene?

    /// Latest insets from SwiftUI, replayed onto any scene we present next.
    private var safeInsets: UIEdgeInsets = .zero

    init() {
        // A placeholder size; `.resizeFill` hands the scene the real dimensions
        // as soon as SpriteView lays out.
        startScene = StartScene(size: CGSize(width: 390, height: 844))
        startScene.reduceMotion = settings.reduceMotion
        startScene.menuDelegate = self

        settings.$reduceMotion
            .removeDuplicates()
            .sink { [weak self] value in self?.startScene.reduceMotion = value }
            .store(in: &cancellables)
    }

    /// Pushes safe-area insets from SwiftUI into whichever scene is on screen.
    func updateSafeInsets(_ insets: EdgeInsets) {
        let converted = UIEdgeInsets(top: insets.top,
                                     left: insets.leading,
                                     bottom: insets.bottom,
                                     right: insets.trailing)
        safeInsets = converted
        startScene.safeInsets = converted
        (presentedScene as? RunPlaceholderScene)?.safeInsets = converted
    }

    /// Called when the app returns to the foreground, so a run saved on the way
    /// out is reflected on the title screen.
    func refreshFromStore() {
        startScene.refreshContinueState()
    }

    // MARK: - Scene transitions

    private func present(_ scene: SKScene, from current: SKScene) {
        guard let view = current.view else { return }
        scene.size = current.size
        scene.scaleMode = .resizeFill
        presentedScene = scene
        view.presentScene(scene, transition: SKTransition.fade(withDuration: 0.55))
    }

    private func enterRun(_ run: RunState) {
        let runScene = RunPlaceholderScene(size: startScene.size, run: run)
        runScene.safeInsets = safeInsets
        runScene.runDelegate = self
        present(runScene, from: startScene)
    }
}

// MARK: - StartSceneDelegate

extension AppModel: StartSceneDelegate {

    func startSceneDidSelectNewRun(_ scene: StartScene) {
        let run = RunStore.shared.startNewRun()
        scene.refreshContinueState()
        enterRun(run)
    }

    func startSceneDidSelectContinueRun(_ scene: StartScene) {
        // The button is disabled without a save, so this is belt-and-braces.
        guard let run = RunStore.shared.current else {
            scene.refreshContinueState()
            return
        }
        enterRun(run)
    }

    func startSceneDidSelectSettings(_ scene: StartScene) {
        isShowingSettings = true
    }
}

// MARK: - RunPlaceholderSceneDelegate

extension AppModel: RunPlaceholderSceneDelegate {

    func runScene(_ scene: RunPlaceholderScene, didExitWith run: RunState) {
        startScene.refreshContinueState()
        present(startScene, from: scene)
    }
}
