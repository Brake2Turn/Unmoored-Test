import SwiftUI

/// The settings sheet reached from the third menu entry.
struct SettingsView: View {

    @ObservedObject var settings: GameSettings

    /// Lets the sheet tell the title screen to relabel Continue Run after a
    /// reset.
    var onProgressReset: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var isConfirmingReset = false
    @State private var hasSavedRun = RunStore.shared.hasSavedRun

    var body: some View {
        NavigationStack {
            Form {
                Section("Audio") {
                    slider(title: "Music", value: $settings.musicVolume)
                    slider(title: "Sound Effects", value: $settings.effectsVolume)
                }

                Section {
                    Toggle("Haptics", isOn: $settings.hapticsEnabled)
                    Toggle("Reduce Motion", isOn: $settings.reduceMotion)
                } header: {
                    Text("Feel")
                } footer: {
                    Text("Reduce Motion calms the drifting starfield and parallax on the title screen.")
                }

                Section {
                    Button(role: .destructive) {
                        isConfirmingReset = true
                    } label: {
                        Text("Reset Progress")
                    }
                    .disabled(!hasSavedRun)
                } footer: {
                    Text(hasSavedRun
                         ? "Discards the run currently in progress. This cannot be undone."
                         : "There is no run in progress.")
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.UI.background.ignoresSafeArea())
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog("Reset progress?",
                                isPresented: $isConfirmingReset,
                                titleVisibility: .visible) {
                Button("Reset Progress", role: .destructive) {
                    RunStore.shared.clear()
                    hasSavedRun = false
                    onProgressReset()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Your current run will be discarded.")
            }
        }
        .tint(Theme.UI.accent)
        .preferredColorScheme(.dark)
    }

    private func slider(title: String, value: Binding<Double>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                Spacer()
                Text("\(Int(value.wrappedValue * 100))%")
                    .foregroundStyle(Theme.UI.textMuted)
                    .monospacedDigit()
            }
            Slider(value: value, in: 0...1)
        }
    }
}
