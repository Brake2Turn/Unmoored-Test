import SpriteKit
import SwiftUI

/// Hosts the SpriteKit scene full-bleed and presents the settings sheet over it.
struct RootView: View {

    @StateObject private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        GeometryReader { proxy in
            SpriteView(
                scene: model.startScene,
                preferredFramesPerSecond: 60,
                options: [.ignoresSiblingOrder]
            )
            .ignoresSafeArea()
            .onAppear { model.updateSafeInsets(proxy.safeAreaInsets) }
            .onChange(of: proxy.safeAreaInsets) { _, insets in
                model.updateSafeInsets(insets)
            }
        }
        .background(Theme.UI.background)
        .statusBarHidden()
        .persistentSystemOverlays(.hidden)
        .sheet(isPresented: $model.isShowingSettings) {
            SettingsView(settings: model.settings) {
                model.refreshFromStore()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { model.refreshFromStore() }
        }
    }
}

#Preview {
    RootView()
}
