const { chromium } = require('playwright');

const baseUrl = 'https://kevinbarbershopwebsite.vercel.app';
const zoomLevels = [50, 67, 80, 90, 110, 125, 150, 175, 200];
const pages = [
  { name: 'Home', url: '/' },
  { name: 'Services section', url: '/#services' },
  { name: 'Staff section', url: '/#staff' },
  { name: 'Book section', url: '/#book' }
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  const findings = [];

  for (const p of pages) {
    await page.goto(baseUrl + p.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    for (const z of zoomLevels) {
      // Emulate browser zoom using CSS zoom on root.
      await page.evaluate((zoom) => {
        document.documentElement.style.zoom = `${zoom}%`;
      }, z);
      await page.waitForTimeout(300);

      const result = await page.evaluate(({ pageName, zoom }) => {
        const vw = document.documentElement.clientWidth;
        const body = document.body;
        const doc = document.documentElement;
        const maxScrollable = Math.max(body.scrollWidth, doc.scrollWidth);
        const globalOverflow = maxScrollable > vw + 1;

        const selectors = {
          nav: ['header nav', 'nav[aria-label*="Primary"]', 'nav', '[data-testid="primary-nav"]'],
          footer: ['footer', '[data-testid="footer"]']
        };

        const check = (arr) => {
          for (const s of arr) {
            const el = document.querySelector(s);
            if (el) return { sel: s, el };
          }
          return null;
        };

        const navMatch = check(selectors.nav);
        const footerMatch = check(selectors.footer);

        const measure = (match) => {
          if (!match) return { found: false };
          const r = match.el.getBoundingClientRect();
          return {
            found: true,
            selector: match.sel,
            rightOverflowPx: Math.max(0, r.right - window.innerWidth),
            leftOverflowPx: Math.max(0, 0 - r.left),
            width: r.width
          };
        };

        const nav = measure(navMatch);
        const footer = measure(footerMatch);

        return {
          pageName,
          zoom,
          viewportWidth: vw,
          scrollWidth: maxScrollable,
          globalOverflow,
          nav,
          footer
        };
      }, { pageName: p.name, zoom: z });

      const hasNavOverflow = result.nav.found && (result.nav.rightOverflowPx > 1 || result.nav.leftOverflowPx > 1);
      const hasFooterOverflow = result.footer.found && (result.footer.rightOverflowPx > 1 || result.footer.leftOverflowPx > 1);

      if (result.globalOverflow || hasNavOverflow || hasFooterOverflow) {
        findings.push(result);
      }
    }

    // Reset zoom before next page
    await page.evaluate(() => { document.documentElement.style.zoom = '100%'; });
  }

  // Pinch-zoom emulation via visual viewport scale transform (mobile-like stress)
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 393, height: 852 });
  await mobile.goto(baseUrl + '/#book', { waitUntil: 'domcontentloaded' });
  await mobile.waitForTimeout(600);

  const pinchScales = [0.5, 0.67, 0.8, 0.9, 1.1, 1.25, 1.5, 1.75, 2.0];
  const pinchFindings = [];
  for (const scale of pinchScales) {
    await mobile.evaluate((s) => {
      // Simulate pinch stress by scaling root container from top-left.
      document.documentElement.style.transformOrigin = 'top left';
      document.documentElement.style.transform = `scale(${s})`;
      document.documentElement.style.width = `${100 / s}%`;
    }, scale);
    await mobile.waitForTimeout(250);

    const res = await mobile.evaluate((s) => {
      const vw = document.documentElement.clientWidth;
      const sw = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
      const nav = document.querySelector('nav') || document.querySelector('header nav');
      const footer = document.querySelector('footer');

      function over(el) {
        if (!el) return { found: false };
        const r = el.getBoundingClientRect();
        return {
          found: true,
          rightOverflowPx: Math.max(0, r.right - window.innerWidth),
          leftOverflowPx: Math.max(0, 0 - r.left)
        };
      }

      return {
        scale: s,
        viewportWidth: vw,
        scrollWidth: sw,
        globalOverflow: sw > vw + 1,
        nav: over(nav),
        footer: over(footer)
      };
    }, scale);

    const hasNavOverflow = res.nav.found && (res.nav.rightOverflowPx > 1 || res.nav.leftOverflowPx > 1);
    const hasFooterOverflow = res.footer.found && (res.footer.rightOverflowPx > 1 || res.footer.leftOverflowPx > 1);

    if (res.globalOverflow || hasNavOverflow || hasFooterOverflow) {
      pinchFindings.push(res);
    }
  }

  const output = {
    timestamp: new Date().toISOString(),
    baseUrl,
    zoomLevels,
    pages,
    findings,
    pinchScales,
    pinchFindings
  };

  console.log(JSON.stringify(output, null, 2));
  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
