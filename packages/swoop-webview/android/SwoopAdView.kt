// SwoopAdView.kt: one Swoop Ads unit in an Android view (API 24+). UNTESTED: written against the public WebView API, not compiled
// in this repository (no Kotlin/Android toolchain on the build machines). Try it in a sample app first.
//
// Usage (in an Activity or Fragment):
//   val ad = SwoopAdView(context, spot = "pk_your_spot_key", unit = "banner", baseUrl = "https://app.example.com")
//   ad.onHeight = { px -> ad.layoutParams = ad.layoutParams.apply { height = (px * resources.displayMetrics.density).toInt() } }
//   ad.onState = { state, reason -> Log.d("swoop", "$state $reason") }
//   container.addView(ad); ad.load()
package com.example.swoop

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import org.json.JSONObject

@SuppressLint("SetJavaScriptEnabled", "ViewConstructor")
class SwoopAdView(
    context: Context,
    spot: String,
    unit: String = "native",
    theme: String = "auto",
    slot: String = "",
    private val baseUrl: String, // an address listed on the Spot's origins; only used as the page address
    template: String = DEFAULT_TEMPLATE, // paste the contents of unit.html, or read it from assets
) : WebView(context) {
    var onHeight: ((Int) -> Unit)? = null
    var onState: ((String, String?) -> Unit)? = null
    private val html = template.replace("{{SPOT}}", spot).replace("{{UNIT}}", unit).replace("{{THEME}}", theme).replace("{{SLOT}}", slot)
    private val main = Handler(Looper.getMainLooper())

    init {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = false // no storage survives
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.setSupportMultipleWindows(false)
        setBackgroundColor(0)
        isVerticalScrollBarEnabled = false
        addJavascriptInterface(object {
            @JavascriptInterface
            fun post(json: String) {
                val m = try { JSONObject(json) } catch (e: Exception) { return }
                main.post {
                    when (m.optString("type")) {
                        "height" -> onHeight?.invoke(m.optInt("h"))
                        "state" -> onState?.invoke(m.optString("state"), m.optString("reason").ifEmpty { null })
                    }
                }
            }
        }, "SwoopBridge")
    }

    fun load() = loadDataWithBaseURL(baseUrl, html, "text/html", "utf-8", null)

    companion object { const val DEFAULT_TEMPLATE = "<paste unit.html>" }
}
