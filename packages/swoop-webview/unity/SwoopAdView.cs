// SwoopAdView.cs: one Swoop Ads unit in a Unity game on iOS or Android. UNTESTED: written against the open-source web view plugin
// gree/unity-webview (MIT, https://github.com/gree/unity-webview) and not compiled here (no Unity on the build machines).
// Unity has no built-in web view; any plugin works if it can (1) load an HTML string with a base address, (2) call back into C# with a
// string. The page (unit.html) calls Unity.call(json) when the plugin provides it.
//
// Setup: add the plugin, put this script on an empty GameObject, fill the fields, and call Show() when the menu with the ad opens.
using System;
using UnityEngine;

public class SwoopAdView : MonoBehaviour
{
    public string spot = "pk_your_spot_key";   // the public Spot key
    public string unit = "banner";             // banner, text or native
    public string theme = "auto";              // light, dark or auto
    public string slot = "";                   // empty = the default for the unit
    public string baseUrl = "https://app.example.com"; // an address listed on the Spot's origins
    public TextAsset template;                 // drag unit.html here

    WebViewObject web;
    float heightDp;

    [Serializable] class Msg { public string type; public float h; public string state; public string reason; }

    public void Show()
    {
        if (web != null || template == null) return;
        var html = template.text.Replace("{{SPOT}}", spot).Replace("{{UNIT}}", unit).Replace("{{THEME}}", theme).Replace("{{SLOT}}", slot);
        web = gameObject.AddComponent<WebViewObject>();
        web.Init(cb: OnMessage, transparent: true);
        web.LoadHTML(html, baseUrl);
        web.SetVisibility(true);
        Layout();
    }

    public void Hide() { if (web != null) { Destroy(web); web = null; } }

    void OnMessage(string json)
    {
        Msg m;
        try { m = JsonUtility.FromJson<Msg>(json); } catch { return; }
        if (m == null) return;
        if (m.type == "height") { heightDp = Mathf.Clamp(m.h, 0, 1200); Layout(); }
        if (m.type == "state") Debug.Log("swoop " + m.state + (string.IsNullOrEmpty(m.reason) ? "" : " " + m.reason));
    }

    // CSS pixels are close to dp: scale to screen pixels and sit the unit at the bottom of the screen.
    void Layout()
    {
        if (web == null) return;
        var px = (int)(heightDp * Screen.dpi / 160f);
        web.SetMargins(0, Screen.height - px, 0, 0);
        web.SetVisibility(px > 0);
    }
}
