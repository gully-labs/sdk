// SwoopAdView.swift: one Swoop Ads unit in a UIKit view (iOS 14+). UNTESTED: written against the public WKWebView API, not compiled
// in this repository (no Swift toolchain on the build machines). Try it in a sample app first.
//
// Usage:
//   let ad = SwoopAdView(spot: "pk_your_spot_key", unit: "banner", baseURL: URL(string: "https://app.example.com")!)
//   ad.onHeight = { h in self.adHeight.constant = h }           // 0 means "nothing to show": collapse the row
//   ad.onState  = { state, reason in print(state, reason ?? "") } // filled, viewed or empty
//   view.addSubview(ad); ad.load()
import UIKit
import WebKit

final class SwoopAdView: UIView, WKScriptMessageHandler {
    var onHeight: ((CGFloat) -> Void)?
    var onState: ((String, String?) -> Void)?
    private let web: WKWebView
    private let html: String
    private let baseURL: URL

    /// `baseURL` must be an address listed on the Spot (the Spot's origins); it is only used as the page's address.
    init(spot: String, unit: String = "native", theme: String = "auto", slot: String = "", baseURL: URL, template: String = SwoopAdView.defaultTemplate) {
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .nonPersistent() // no cookies or storage survive
        web = WKWebView(frame: .zero, configuration: cfg)
        self.baseURL = baseURL
        html = template
            .replacingOccurrences(of: "{{SPOT}}", with: spot)
            .replacingOccurrences(of: "{{UNIT}}", with: unit)
            .replacingOccurrences(of: "{{THEME}}", with: theme)
            .replacingOccurrences(of: "{{SLOT}}", with: slot)
        super.init(frame: .zero)
        cfg.userContentController.add(self, name: "swoop")
        web.isOpaque = false
        web.backgroundColor = .clear
        web.scrollView.isScrollEnabled = false
        web.translatesAutoresizingMaskIntoConstraints = false
        addSubview(web)
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: leadingAnchor), web.trailingAnchor.constraint(equalTo: trailingAnchor),
            web.topAnchor.constraint(equalTo: topAnchor), web.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }
    required init?(coder: NSCoder) { fatalError("use init(spot:...)") }

    func load() { web.loadHTMLString(html, baseURL: baseURL) }

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let s = message.body as? String, let d = s.data(using: .utf8),
              let m = try? JSONSerialization.jsonObject(with: d) as? [String: Any], let type = m["type"] as? String else { return }
        DispatchQueue.main.async {
            if type == "height", let h = m["h"] as? Double { self.onHeight?(CGFloat(h)) }
            if type == "state", let st = m["state"] as? String { self.onState?(st, m["reason"] as? String) }
        }
    }

    /// Paste the contents of unit.html here (or load it from your app bundle).
    static let defaultTemplate = "<paste unit.html>"
}
