/**
 * Vitalis Tracking Script
 *
 * Handles:
 * - Web Vitals (LCP, INP, CLS, FCP, TTFB) → dashboard API
 * - Phone click tracking (tel: links → dashboard API)
 * - WhatsApp click tracking (wa.me links → dashboard API)
 *
 * Requires: nothing — works as standalone vanilla JS.
 * Sends data to the dashboard API with CORS configured on the API side.
 */
(function () {
  "use strict";

  var API_BASE = "https://vitalis.insight.artifact.cl";

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function getPath() {
    return window.location.pathname.replace(/\/$/, "") || "/";
  }

  function getDevice() {
    return /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";
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

  function sendVital(name, value, rating) {
    sendBeacon(API_BASE + "/api/vitals", {
      name: name,
      value: Math.round(value * 100) / 100,
      rating: rating || "good",
      page: getPath(),
      device: getDevice(),
      connection: navigator.connection && navigator.connection.effectiveType
        ? navigator.connection.effectiveType
        : "unknown",
    });
  }

  // ─── Web Vitals (via PerformanceObserver) ─────────────────────────────────

  if (window.PerformanceObserver) {
    // CLS — Cumulative Layout Shift (accumulates throughout the page lifetime)
    var clsValue = 0;
    var clsFinalized = false;

    try {
      var clsObs = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++) {
          if (!entries[i].hadRecentInput) {
            clsValue += entries[i].value;
          }
        }
      });
      clsObs.observe({ type: "layout-shift", buffered: true });
    } catch (e) {}

    // LCP — Largest Contentful Paint (can update as images load, so we keep the latest)
    try {
      var lcpObs = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        if (entries.length > 0) {
          var lastEntry = entries[entries.length - 1];
          sendVital("LCP", lastEntry.startTime, lastEntry.startTime < 2500 ? "good" : lastEntry.startTime < 4000 ? "needs-improvement" : "poor");
        }
      });
      lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
    } catch (e) {}

    // INP / FID — First Input Delay
    try {
      var inpObs = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          var delay = e.processingStart - e.startTime;
          sendVital("INP", delay, delay < 200 ? "good" : delay < 500 ? "needs-improvement" : "poor");
        }
      });
      inpObs.observe({ type: "first-input", buffered: true });
    } catch (e) {}

    // FCP — First Contentful Paint (fires once)
    try {
      var fcpObs = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        if (entries.length > 0) {
          var fcp = entries[0].startTime;
          sendVital("FCP", fcp, fcp < 1800 ? "good" : fcp < 3000 ? "needs-improvement" : "poor");
        }
      });
      fcpObs.observe({ type: "paint", buffered: true });
    } catch (e) {}
  }

  // TTFB — Time to First Byte (via Navigation Timing API — fires once)
  if (window.performance && performance.getEntriesByType) {
    var navEntries = performance.getEntriesByType("navigation");
    if (navEntries.length > 0) {
      var nav = navEntries[0];
      var ttfb = nav.responseStart - nav.requestStart;
      sendVital("TTFB", ttfb, ttfb < 800 ? "good" : ttfb < 1800 ? "needs-improvement" : "poor");
    }
  }

  // ─── Flush CLS on page unload ─────────────────────────────────────────────
  // CLS is cumulative, so we must report the FINAL value when the user leaves.
  // Using sendBeacon guarantees the request completes even during page unload.

  function flushCLS() {
    if (clsFinalized) return;
    clsFinalized = true;

    if (clsValue > 0) {
      sendVital("CLS", clsValue, clsValue < 0.1 ? "good" : clsValue < 0.25 ? "needs-improvement" : "poor");
    }
  }

  // pagehide fires on mobile Safari and modern browsers during navigation/close
  if (window.addEventListener) {
    window.addEventListener("pagehide", flushCLS);
    // visibilitychange to "hidden" catches desktop browser tab closes
    window.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        flushCLS();
      }
    });
    // beforeunload as fallback for older browsers
    window.addEventListener("beforeunload", flushCLS);
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
