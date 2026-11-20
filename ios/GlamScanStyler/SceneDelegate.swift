import UIKit
import React
import GoogleSignIn
#if canImport(AppTrackingTransparency)
import AppTrackingTransparency
#endif

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = (scene as? UIWindowScene) else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window

    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else {
      return
    }

    factory.startReactNative(
      withModuleName: "GlamScanStyler",
      in: window,
      launchOptions: appDelegate.initialLaunchOptions
    )

    // Handle cold-start custom scheme URL (e.g., Google Sign-In)
    if let urlContext = connectionOptions.urlContexts.first {
      if GIDSignIn.sharedInstance.handle(urlContext.url) {
        return
      }
      _ = RCTLinkingManager.application(
        UIApplication.shared,
        open: urlContext.url,
        options: [:]
      )
    }

    // Handle cold-start Universal Link
    if let userActivity = connectionOptions.userActivities.first(where: { $0.activityType == NSUserActivityTypeBrowsingWeb }) {
      _ = RCTLinkingManager.application(
        UIApplication.shared,
        continue: userActivity,
        restorationHandler: { _ in }
      )
    }
  }

  // Handle Universal Links while app is running
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }

  // Handle Custom URL Schemes while app is running
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    if GIDSignIn.sharedInstance.handle(url) {
      return
    }
    _ = RCTLinkingManager.application(
      UIApplication.shared,
      open: url,
      options: [:]
    )
  }

  // MARK: - Scene Lifecycle & App Tracking Transparency
  func sceneDidBecomeActive(_ scene: UIScene) {
    // Apple App Tracking Transparency (ATT):
    // Must be requested when application state is active and key window is presented.
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
      if #available(iOS 14, *) {
        #if canImport(AppTrackingTransparency)
        if ATTrackingManager.trackingAuthorizationStatus == .notDetermined {
          ATTrackingManager.requestTrackingAuthorization { status in
            NSLog("📱 [ATT Native] Scene tracking authorization status: %ld", status.rawValue)
          }
        }
        #endif
      }
    }
  }
}
