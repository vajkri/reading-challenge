import Script from "next/script";

const GA_ID = "G-TKWB5RGY4V";

// GA4 must fire only on the deployed GitHub Pages site — never on local dev
// (localhost:3000) nor the Playwright e2e build (localhost:4399), both of
// which would otherwise pollute analytics. Hostname is the only reliable
// runtime signal: e2e serves the exact same static export as Pages, so
// NODE_ENV can't distinguish them. The gate lives inside the bootstrap script
// so the rendered markup is byte-identical everywhere (no hydration mismatch)
// and localhost makes no gtag.js request at all.
export default function Analytics() {
  return (
    <Script id="ga4-init" strategy="afterInteractive">
      {`(function(){
  var h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return;
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
