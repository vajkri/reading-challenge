import Script from "next/script";

const GA_ID = "G-TKWB5RGY4V";

// The deployed GitHub Pages host. GA4 fires ONLY here.
const PAGES_HOST = "vajkri.github.io";

// GA4 must fire only on the deployed GitHub Pages site — never on local dev,
// the Playwright e2e build (localhost:4399), or on-device PWA testing over the
// LAN ([::1] / 0.0.0.0 / 192.168.x.x), any of which would otherwise pollute
// production analytics. This is an *allowlist*, not a denylist: any unknown
// host defaults to OFF, so we can't leak page_views from a host we forgot to
// exclude. (If the site ever moves to a custom domain, update PAGES_HOST.)
// Hostname is the only reliable runtime signal — e2e serves the exact same
// static export as Pages, so NODE_ENV can't distinguish them. The gate lives
// inside the bootstrap script so the rendered markup is byte-identical
// everywhere (no hydration mismatch) and non-prod hosts make no gtag.js
// request at all.
export default function Analytics() {
  return (
    <Script id="ga4-init" strategy="afterInteractive">
      {`(function(){
  if (location.hostname !== '${PAGES_HOST}') return;
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag;
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=${GA_ID}';
  document.head.appendChild(s);
  gtag('js', new Date());
  gtag('config', '${GA_ID}');
})();`}
    </Script>
  );
}
