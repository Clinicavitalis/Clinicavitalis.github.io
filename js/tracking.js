/**
 * Vitalis Tracking Script
 *
 * Handles:
 * - Phone click tracking (tel: links → dashboard API)
 * - WhatsApp click tracking (wa.me links → dashboard API)
 *
 * This is a lightweight script that sends beacons to the dashboard API
 * from the static site. CORS is configured on the API side.
 *
 * Requires: nothing — works as standalone vanilla JS.
 */
(function () {
  "use strict";

  var API_BASE = "https://vitalis.insight.artifact.cl";
  var TENANT_SLUG = "vitalis";

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function getPath() {
    return window.location.pathname.replace(/\/$/, "") || "/";
  }

  function sendBeacon(url, data) {
    var body = JSON.stringify(data);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, body);
    } else {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true,
      }).catch(function () {});
    }
  }

  // ─── Phone Click Tracking ─────────────────────────────────────────────────

  document.addEventListener("click", function (e) {
    var target = e.target.closest("a[href^='tel:']");
    if (!target) return;

    var href = target.getAttribute("href") || "";
    var phoneNumber = href.replace("tel:", "").trim();
    var page = getPath();

    sendBeacon(API_BASE + "/api/phone-clicks", {
      page: page,
      phoneNumber: phoneNumber,
    });
  }, true);

  // ─── WhatsApp Click Tracking ──────────────────────────────────────────────

  document.addEventListener("click", function (e) {
    var target = e.target.closest("a[href*='wa.me/']");
    if (!target) return;

    var page = getPath();
    var button = target.classList.contains("btn-flotante-wsp")
      ? "flotante"
      : target.classList.contains("btn-whatsapp")
        ? "hero"
        : "enlace";

    sendBeacon(API_BASE + "/api/whatsapp", {
      page: page,
      button: button,
      phone: "56957006747",
    });
  }, true);

})();
