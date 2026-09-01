/**
 * End to end checks against the rendered site.
 *
 * These assert on the HTML and CSS a browser actually receives, which is the
 * only place some of the specification's rules can be checked. Section 07 is
 * the clearest case: the rule is not "the database holds a ratio per category",
 * it is "the frame in the grid carries that ratio and the photograph inside it
 * is never cropped". That is a property of the served page.
 *
 * Run with both services up:
 *   node scripts/e2e.mjs
 *
 * Override the origin with SITE_URL. Defaults to http://127.0.0.1:3010.
 */

import test from "node:test";
import assert from "node:assert/strict";

const SITE = process.env.SITE_URL ?? "http://127.0.0.1:3010";

/**
 * Reduce a response to just its rendered markup.
 *
 * Three things are removed so an assertion reads the text a person sees:
 *   - Next.js's serialised flight payload, which repeats every string.
 *   - React's empty comment separators. React writes `<!-- -->` between two
 *     adjacent text nodes, so `{name}, shown` reaches the browser as
 *     `Nero Marquina<!-- -->, shown`. It is invisible, and matching around it
 *     would make every assertion unreadable.
 *   - Line breaks and runs of whitespace introduced by JSX indentation.
 */
function markup(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ");
}

/** Normalise a selector so it compares equal minified or not. */
function normalise(selector) {
  return selector
    .replace(/\s*([>+~])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Every declaration that the stylesheet applies to one selector.
 *
 * Reading a single rule by its selector is not enough against a production
 * build. The minifier closes up whitespace around combinators, and it also
 * lifts declarations shared by several selectors into a grouped rule, so
 * `.founder blockquote` arrives as two rules: one of its own, and one it
 * shares with `.founder__role`. Matching only the first would report a
 * declaration as missing when it is present.
 *
 * So this collects the body of every rule whose selector list names the
 * selector exactly, in source order, and hands back the lot. That also lets
 * the same suite run against `next dev`, where nothing is minified or
 * grouped at all.
 */
function rule(sheet, selector) {
  const wanted = normalise(selector);
  const bodies = [];
  for (const match of sheet.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = match[1].split(",").map(normalise);
    if (selectors.includes(wanted)) bodies.push(match[2]);
  }
  assert.ok(bodies.length > 0, `no rule found for ${selector}`);
  return bodies.join(";");
}

const cache = new Map();

async function page(path) {
  if (cache.has(path)) return cache.get(path);
  const response = await fetch(`${SITE}${path}`);
  const body = await response.text();
  const entry = { status: response.status, html: markup(body), raw: body };
  cache.set(path, entry);
  return entry;
}

async function status(path) {
  const response = await fetch(`${SITE}${path}`, { redirect: "manual" });
  return response.status;
}

let stylesheet = null;
async function css() {
  if (stylesheet) return stylesheet;
  const { raw } = await page("/collection/dining-tables");
  /*
   * Next 15 emitted the stylesheet under /_next/static/css/. Next 16 builds
   * with Turbopack and emits it under /_next/static/chunks/ alongside the
   * JavaScript. Matching any .css under /_next/static/ covers both, so this
   * suite does not have to be edited again the next time the bundler moves
   * its output.
   */
  const hrefs = [...raw.matchAll(/\/_next\/static\/[^"]+?\.css/g)].map((m) => m[0]);
  assert.ok(hrefs.length > 0, "no stylesheet found on the page");
  const parts = await Promise.all(
    [...new Set(hrefs)].map(async (href) => (await fetch(`${SITE}${href}`)).text()),
  );
  stylesheet = parts.join("\n");
  return stylesheet;
}

const CATEGORIES = [
  ["dining-tables", "3-2"],
  ["coffee-tables", "3-2"],
  ["console-tables", "4-5"],
  ["side-tables", "4-5"],
  ["bedside-tables", "4-5"],
  ["plinths", "4-5"],
];

// --------------------------------------------------------------- reachability

test("every route in the site architecture renders", async () => {
  const routes = [
    "/",
    "/collection",
    ...CATEGORIES.map(([slug]) => `/collection/${slug}`),
    "/atelier",
    "/atelier/bespoke",
    "/atelier/materials",
    "/care",
    "/trade",
    "/enquire",
    "/legal/terms",
    "/legal/shipping",
    "/legal/returns",
    "/legal/privacy",
  ];
  for (const route of routes) {
    assert.equal(await status(route), 200, `${route} did not return 200`);
  }
});

test("every launch piece has a product page", async () => {
  const pieces = [
    "dining-tables/roma",
    "dining-tables/faro",
    "dining-tables/luna",
    "coffee-tables/otis-coffee",
    "coffee-tables/otis-oval",
    "coffee-tables/ida",
    "console-tables/orla",
    "console-tables/esme",
    "side-tables/otis-side",
    "side-tables/ria",
    "side-tables/alaia",
    "side-tables/oria-side",
    "plinths/nova",
    "plinths/oria-plinth",
  ];
  for (const piece of pieces) {
    assert.equal(await status(`/collection/${piece}`), 200, piece);
  }
});

/**
 * The standing regression case.
 *
 * A piece reaches the public site only when it is live AND priced. Kaia is a
 * complete record with no price, so it must be absent from every surface a
 * visitor or a crawler can reach, not just from the route that regressed
 * last time.
 */
test("Kaia is absent from every rendered surface", async () => {
  assert.equal(await status("/collection/bedside-tables/kaia"), 404);

  for (const route of [
    "/",
    "/collection",
    "/collection/bedside-tables",
    "/atelier",
    "/trade",
    "/enquire",
    "/sitemap.xml",
  ]) {
    const { raw } = await page(route);
    assert.ok(
      !/kaia/i.test(raw),
      `${route} names Kaia, which is withheld from the site`,
    );
  }
});

/**
 * robots.txt has always pointed at /sitemap.xml. Until revision 6 that URL
 * returned a 404, so every crawler that followed the reference found nothing.
 */
test("the sitemap exists and lists only publicly visible pieces", async () => {
  assert.equal(await status("/sitemap.xml"), 200);
  const { raw } = await page("/sitemap.xml");

  const listed = [...raw.matchAll(/<loc>[^<]*\/collection\/[^/]+\/([^<]+)<\/loc>/g)].map(
    (m) => m[1],
  );
  assert.ok(listed.length > 0, "the sitemap lists no pieces at all");

  // Exactly the pieces the API is willing to serve, no more and no fewer.
  const response = await fetch(`${SITE}/api/products`);
  const visible = (await response.json()).map((p) => p.slug).sort();
  assert.deepEqual(listed.sort(), visible, "the sitemap and the API disagree");

  const { raw: robots } = await page("/robots.txt");
  assert.match(robots, /Sitemap:\s*https:\/\/collectionnoir\.com\/sitemap\.xml/i);
});

// ------------------------------------------------------- section 07, the grid

test("each category grid carries only its own aspect ratio", async () => {
  for (const [slug, expected] of CATEGORIES) {
    const { html } = await page(`/collection/${slug}`);
    const found = new Set(
      [...html.matchAll(/category-image ratio-([0-9-]+)/g)].map((m) => m[1]),
    );
    if (slug === "bedside-tables") continue; // no published pieces at launch
    assert.deepEqual(
      [...found],
      [expected],
      `${slug} should frame at ${expected} only, found ${[...found]}`,
    );
  }
});

test("the ratios across the site are genuinely not one global default", async () => {
  const seen = new Set();
  for (const [slug] of CATEGORIES) {
    const { html } = await page(`/collection/${slug}`);
    for (const m of html.matchAll(/category-image ratio-([0-9-]+)/g)) seen.add(m[1]);
  }
  assert.deepEqual([...seen].sort(), ["3-2", "4-5"]);
});

test("category and product frames use contain, never cover", async () => {
  const sheet = await css();
  for (const selector of [".category-image", ".product__image", ".material-card__image"]) {
    const body = rule(sheet, selector);
    assert.match(body, /background-size:\s*contain/, `${selector} must contain`);
    assert.doesNotMatch(body, /background-size:\s*cover/, `${selector} must never cover`);
  }
});

test("cover appears only on the full bleed hero band", async () => {
  const sheet = await css();
  // Walk every rule in the sheet and collect the selectors that set cover.
  const owners = [];
  for (const match of sheet.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (/background-size:\s*cover/.test(match[2])) owners.push(match[1].trim());
  }
  /*
   * Two selectors, and only two.
   *
   * The hero is a full bleed viewport band. The material sample is the other
   * exception section 9 allows, and the reason is worth keeping: a material
   * is a surface, not an object, so there is no silhouette to crop into and
   * no edge to lose. Every frame that holds a piece of furniture letterboxes.
   *
   * The data attribute matters. Without a sample photograph the same frame
   * falls back to a flat swatch colour, and stretching that would be
   * meaningless, so cover is opted into rather than applied to the class.
   */
  assert.deepEqual(
    owners,
    [".hero__frame", ".material-card__image[data-photo=true]"],
    `cover appears where it should not: ${owners.join(" | ")}`,
  );
});

test("the letterbox mount is the specified colour", async () => {
  const sheet = await css();
  assert.match(sheet, /--cn-letterbox:\s*#f0ece3/i);
  assert.match(
    rule(sheet, ".category-image"),
    /background-color:\s*var\(--cn-letterbox\)/,
  );
});

test("the grid geometry matches the reference CSS in section 07", async () => {
  const sheet = await css();
  const body = rule(sheet, ".category-grid");
  assert.match(body, /grid-template-columns:\s*1fr 1fr 1fr/);
  assert.match(body, /gap:\s*var\(--cn-grid-gap\)/);
  assert.match(sheet, /--cn-grid-gap:\s*28px/);
  assert.match(rule(sheet, ".category-image.ratio-3-2"), /aspect-ratio:\s*3\s*\/\s*2/);
  assert.match(rule(sheet, ".category-image.ratio-4-5"), /aspect-ratio:\s*4\s*\/\s*5/);
});

// ------------------------------------------------------- section 03, palette

/*
 * Section 0 of the frontend correction brief, which the client has confirmed
 * takes precedence over the specification and the earlier prototype.
 *
 * Ink and Umber have swapped register against the values this suite asserted
 * previously: Ink is the warm near black that carries all text, and Umber is
 * the footer ground. Clay and the hairline have both moved a shade. All four
 * changes are logged in PENDING_CHANGES.md.
 */
test("the palette matches the design system token for token", async () => {
  const sheet = await css();
  const expected = {
    "--cn-ink": "#1c1714",
    "--cn-umber": "#2b2722",
    "--cn-bark": "#9c8272",
    "--cn-clay": "#c4ad97",
    "--cn-ivory": "#faf8f3",
    "--cn-letterbox": "#f0ece3",
    "--cn-hairline": "#eae4d9",
    "--cn-field": "#e0d9cc",
    "--cn-on-dark-strong": "#f2ede6",
    "--cn-on-dark": "#e8e4dc",
  };
  for (const [token, value] of Object.entries(expected)) {
    const match = sheet.match(new RegExp(`${token}:\\s*([^;]+);`));
    assert.ok(match, `${token} is missing`);
    assert.equal(match[1].trim().toLowerCase(), value, token);
  }
});

test("no pure black and no pure white anywhere in the stylesheet", async () => {
  const sheet = await css();
  for (const banned of ["#000000", "#ffffff", "#000;", "#fff;"]) {
    assert.ok(!sheet.toLowerCase().includes(banned), `${banned} is in the stylesheet`);
  }
});

test("the footer sits on Umber, the darkest ground", async () => {
  const sheet = await css();
  assert.match(rule(sheet, ".site-footer"), /background:\s*var\(--cn-umber\)/);
});

// ------------------------------------------- section 1, one typeface only
//
// The single biggest fault in the reviewed build: every paragraph rendered in
// system sans because the body font token pointed at Arial. These assert on
// the served stylesheet, which is where that fault lived.

test("there is no sans anywhere in the served stylesheet", async () => {
  const sheet = await css();
  for (const banned of ["arial", "helvetica", "system-ui", "sans-serif"]) {
    assert.ok(
      !sheet.toLowerCase().includes(banned),
      `the stylesheet still names ${banned}`,
    );
  }
});

test("the body carries Cormorant, at the specified size and weight", async () => {
  const sheet = await css();
  const body = rule(sheet, "body");
  assert.match(body, /font-family:\s*var\(--cn-font\)/, "body font is not the token");
  assert.match(body, /font-weight:\s*300/);
  assert.match(body, /font-size:\s*var\(--cn-size-body\)/);
  // The token itself resolves to Cormorant, with a serif fallback rather than
  // a sans, so a failed webfont load still reads as a serif.
  const token = /--cn-font:\s*([^;]+);/.exec(sheet);
  assert.ok(token, "--cn-font is missing");
  assert.match(token[1], /--font-cormorant/);
  assert.match(token[1], /Georgia/);
});

test("the webfont is self hosted and both cuts are built", async () => {
  const sheet = await css();
  const faces = [...sheet.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(faces.length > 0, "no @font-face is served, so the font never loads");

  /*
   * next/font emits one extra face that is not a downloaded file: a metric
   * adjusted local face that stands in until the real one arrives, so the
   * page does not reflow as it loads. It has to be a serif, otherwise the
   * first paint is the system sans this whole section exists to remove.
   */
  const [fallback] = faces.filter((face) => /src:\s*local\(/.test(face));
  assert.ok(fallback, "no adjusted fallback face was built");
  assert.match(
    fallback,
    /local\("?(Times New Roman|Georgia)"?\)/,
    "the fallback is not a serif",
  );

  /*
   * What matters is that no font request leaves this origin, not the exact
   * shape of the URL. Next 15 wrote an absolute `/_next/static/media/...`;
   * Next 16 builds with Turbopack and writes it relative to the stylesheet,
   * as `../media/...`. Both are same-origin. Asserting the absence of a
   * scheme catches the thing worth catching, which is a face served from a
   * third party.
   */
  for (const face of faces.filter((face) => face !== fallback)) {
    const src = /src:\s*url\(([^)]+)\)/.exec(face);
    assert.ok(src, `a face declares no src: ${face.slice(0, 80)}`);
    assert.doesNotMatch(
      src[1],
      /^["']?(https?:)?\/\//,
      `font is served from another origin: ${src[1]}`,
    );
    assert.match(src[1], /\.woff2?$|\.woff2?["']?$/, `unexpected font URL: ${src[1]}`);
  }
  // A silently failed or partial load is the likeliest cause of body copy
  // falling back to a system face, so both cuts are asserted rather than
  // assumed.
  assert.ok(
    faces.some((face) => /font-style:\s*normal/.test(face)),
    "no roman cut was built",
  );
  assert.ok(
    faces.some((face) => /font-style:\s*italic/.test(face)),
    "no italic cut was built",
  );

  const { raw } = await page("/");
  assert.ok(
    !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(raw),
    "a font request reaches Google at runtime",
  );
});

test("the type scale matches section 1.4", async () => {
  const sheet = await css();
  const expected = {
    "--cn-size-swatch": "9px",
    "--cn-size-micro": "11px",
    "--cn-size-body": "15px",
    "--cn-size-cta": "16px",
    "--cn-size-caption": "16px",
    "--cn-size-card": "20px",
    "--cn-size-statement": "22px",
    "--cn-size-section": "23px",
    "--cn-size-collection": "26px",
    "--cn-size-page": "30px",
    "--cn-size-product": "32px",
    "--cn-size-headline": "40px",
  };
  for (const [token, value] of Object.entries(expected)) {
    const match = sheet.match(new RegExp(`${token}:\\s*([^;]+);`));
    assert.ok(match, `${token} is missing`);
    // A minifier drops the leading zero, so `0.2em` is served as `.2em`.
    // Compare the number rather than the spelling.
    const got = parseFloat(match[1]);
    assert.equal(got, parseFloat(value), `${token} is ${match[1].trim()}`);
  }
});

/**
 * Section 1.4 sets tracking by context rather than by size: a breadcrumb and
 * a page eyebrow are both 11px and track differently. One shared token cannot
 * express that, so the four values are asserted individually, and the old
 * shared token is asserted absent because a stray reference to it would
 * resolve to nothing and silently drop the tracking.
 */
test("all four tracking values exist and the shared token is gone", async () => {
  const sheet = await css();
  for (const [token, value] of Object.entries({
    "--cn-track-20": "0.2em",
    "--cn-track-22": "0.22em",
    "--cn-track-24": "0.24em",
    "--cn-track-26": "0.26em",
  })) {
    const match = sheet.match(new RegExp(`${token}:\\s*([^;]+);`));
    assert.ok(match, `${token} is missing`);
    // A minifier drops the leading zero, so `0.2em` is served as `.2em`.
    // Compare the number rather than the spelling.
    const got = parseFloat(match[1]);
    assert.equal(got, parseFloat(value), `${token} is ${match[1].trim()}`);
  }
  assert.ok(
    !sheet.includes("--cn-track-micro"),
    "the old shared tracking token is still referenced",
  );
});

// --------------------------------------------- section 2, gutter and measure

test("the page gutter is 48px and the header shares it", async () => {
  const sheet = await css();
  assert.match(sheet, /--cn-page-padding:\s*48px/);
  // Longhands rather than the shorthand. `page` and `section` are used
  // together on one element throughout the site and have equal specificity,
  // so written as shorthands whichever was declared second won the whole
  // property and reset the other two edges to zero.
  assert.match(rule(sheet, ".page"), /padding-left:\s*var\(--cn-page-padding\)/);
  assert.match(rule(sheet, ".page"), /padding-right:\s*var\(--cn-page-padding\)/);
  assert.match(
    rule(sheet, ".site-header"),
    /padding:\s*24px var\(--cn-page-padding\)/,
    "the header does not share the page gutter",
  );
  // The footer's rows carry the gutter rather than the footer itself, so the
  // Umber ground runs edge to edge while the copy on it lines up with the
  // page above. Section 3.
  assert.match(
    rule(sheet, ".site-footer__columns"),
    /padding:\s*34px var\(--cn-page-padding\) 30px/,
    "the footer's upper row does not share the page gutter",
  );
  assert.match(
    rule(sheet, ".site-footer__base"),
    /padding:\s*18px var\(--cn-page-padding\) 22px/,
    "the footer's base row does not share the page gutter",
  );
});

/**
 * Section 13: body copy runs the full width of its column, and a centred
 * max-width container is named as the most visible fault of the earlier
 * build. There is therefore no general measure at all any more, not even a
 * generous one.
 *
 * Six blocks are capped, each named individually by the specification. The
 * set is asserted closed in both directions: every named cap is present at
 * its stated value, and the blocks that must run full width carry none.
 */
test("only the six named blocks carry a measure", async () => {
  const sheet = await css();

  const capped = {
    ".measure-statement": "21em",
    ".measure-designers": "68em",
    ".measure-exploring": "46em",
    ".measure-invitation": "44em",
    ".measure-quote": "26em",
    ".measure-regarding": "30em",
  };
  for (const [selector, value] of Object.entries(capped)) {
    assert.match(
      rule(sheet, selector),
      new RegExp(`max-width:\\s*${value}`),
      `${selector} is not capped at ${value}`,
    );
  }

  assert.ok(
    !/\.measure\s*\{/.test(sheet),
    "the general 75ch measure is still in the stylesheet",
  );

  for (const selector of [
    ".product__description",
    ".product__note",
    ".trade-intro__body",
    ".split__body",
  ]) {
    assert.doesNotMatch(
      rule(sheet, selector),
      /max-width/,
      `${selector} is capped, and section 13 says it runs full width`,
    );
  }
});

/**
 * Section 4.2. The cap belongs to the paragraph rather than to the band, so
 * 21em is 21em of text and not 21em minus two 48px gutters.
 */
test("the homepage statement is centred, Ink, and capped on its paragraph", async () => {
  const sheet = await css();
  assert.match(rule(sheet, ".statement"), /text-align:\s*center/);
  assert.match(rule(sheet, ".statement"), /padding:\s*88px var\(--cn-page-padding\) 0/);
  assert.match(rule(sheet, ".statement p"), /color:\s*var\(--cn-ink\)/);
  assert.doesNotMatch(rule(sheet, ".statement"), /max-width/);
});

/**
 * Section 13's checklist, as far as it can be read off the served CSS. Each
 * of these is something the previous build got wrong, so each is worth a
 * line here rather than a note in a document.
 */
test("the section 13 checklist holds in the stylesheet", async () => {
  const sheet = await css();

  // The logo is 44px, not 48px.
  assert.match(rule(sheet, ".lockup img"), /height:\s*44px/);

  // 46px swatches on a 26px gap, so ARABESCATO and MARQUINA do not collide.
  assert.match(rule(sheet, ".swatch"), /width:\s*46px/);
  assert.match(rule(sheet, ".swatches"), /gap:\s*26px/);
  assert.match(rule(sheet, ".swatch__name"), /white-space:\s*nowrap/);

  // The Enquire call to action: 16px at 0.26em, uppercase, and not italic.
  const cta = rule(sheet, ".cta");
  assert.match(cta, /font-size:\s*var\(--cn-size-cta\)/);
  assert.match(cta, /letter-spacing:\s*var\(--cn-track-26\)/);
  assert.match(cta, /text-transform:\s*uppercase/);
  assert.doesNotMatch(cta, /font-style:\s*italic/);

  // The enquiry page keeps its asymmetric indent.
  assert.match(rule(sheet, ".enquire__left"), /padding:\s*48px 24px 80px 96px/);

  // The bridge that stops the Atelier menu flickering shut as the pointer
  // travels down onto it. Section 2.1 asks for it to be kept.
  assert.match(rule(sheet, ".site-nav__item > a"), /padding-bottom:\s*18px/);
  assert.match(rule(sheet, ".site-nav__item > a"), /margin-bottom:\s*-18px/);
});

// ----------------------------------------------- section 02, copy and devices

test("no decorative full width rule is used as a device", async () => {
  // The only <hr> on the site is the short structural rule on a product page
  // between the price and the call to action.
  for (const route of ["/", "/collection", "/collection/dining-tables", "/atelier", "/trade"]) {
    const { html } = await page(route);
    assert.equal((html.match(/<hr/g) ?? []).length, 0, `${route} renders a horizontal rule`);
  }
  const { html } = await page("/collection/dining-tables/roma");
  const rules = html.match(/<hr[^>]*>/g) ?? [];
  assert.equal(rules.length, 1);
  assert.match(rules[0], /product__rule/);
});

/**
 * Section 02 rules out the em dash. The client approved design uses one in two
 * places, and the client has confirmed that design is authoritative, so those
 * two strings are allowed through and the rule holds everywhere else. Both are
 * listed in PENDING_CHANGES.md as a conflict between the two client documents.
 */
const APPROVED_EM_DASHES = [
  /[A-Z]+ — SHOWN/g, // the material shown, on a product page
  /shade and pattern — these variations/g, // the materials note
];

test("no em dash reaches the rendered page", async () => {
  for (const route of [
    "/",
    "/collection",
    "/collection/dining-tables",
    "/collection/dining-tables/roma",
    "/atelier",
    "/atelier/materials",
    "/trade",
    "/enquire",
  ]) {
    const { html } = await page(route);
    let remaining = html;
    for (const approved of APPROVED_EM_DASHES) remaining = remaining.replace(approved, "");
    assert.ok(!remaining.includes("—"), `${route} contains an unapproved em dash`);
  }
});

test("no cart or basket language anywhere", async () => {
  for (const route of ["/collection/dining-tables", "/collection/dining-tables/roma", "/enquire"]) {
    const { html } = await page(route);
    const lower = html.toLowerCase();
    for (const banned of ["add to cart", "add to basket", "checkout", "buy now", "shop now"]) {
      assert.ok(!lower.includes(banned), `${route} contains "${banned}"`);
    }
  }
});

test("brand copy says material rather than stone", async () => {
  const { html } = await page("/collection/console-tables");
  assert.match(html, /specific length or material/);
  const roma = await page("/collection/dining-tables/roma");
  assert.match(roma.html, /Further materials available upon request/);
});

// -------------------------------------------------- section 09, price display

test("category grids read Starting from", async () => {
  const { html } = await page("/collection/dining-tables");
  for (const price of ["Starting from £6,750", "Starting from £12,000", "Starting from £12,800"]) {
    assert.ok(html.includes(price), `missing ${price}`);
  }
});

test("prices carry a comma separator and no decimals", async () => {
  const { html } = await page("/collection/dining-tables");
  const prices = [...html.matchAll(/£[\d,.]+/g)].map((m) => m[0]);
  assert.ok(prices.length > 0);
  for (const price of prices) {
    assert.doesNotMatch(price, /\./, `${price} shows decimals`);
  }
  assert.ok(prices.includes("£12,000"), "thousands separator missing");
});

test("no price on application renders anywhere", async () => {
  for (const [slug] of CATEGORIES) {
    const { html } = await page(`/collection/${slug}`);
    assert.ok(!/price on application/i.test(html), slug);
    assert.ok(!/\bPOA\b/.test(html), slug);
  }
});

// ------------------------------------------------------------ the mockups

test("the header is the lockup left, navigation right", async () => {
  const { html } = await page("/");
  // The supplied wordmark as a finished asset, not set in type.
  assert.match(html, /class="lockup"/);
  assert.match(html, /src="\/brand\/collection-noir-dark\.png"/);
  assert.match(html, /alt="Collection Noir"/);
  for (const item of ["Collection", "Atelier", "Trade", "Enquire"]) {
    assert.match(html, new RegExp(`href="/${item.toLowerCase()}"[^>]*>${item}<`));
  }
});

test("the Atelier item carries its menu in the served markup", async () => {
  const { html } = await page("/");
  const menu = /site-nav__menu[\s\S]*?<\/div>/.exec(html);
  assert.ok(menu, "no menu under the Atelier item");
  assert.match(menu[0], /href="\/atelier"[^>]*>The Atelier</);
  assert.match(menu[0], /href="\/atelier\/materials">Materials</);
});

test("the lockup is one asset, sized as a whole, and appears once", async () => {
  const sheet = await css();
  // Reconstructing the wordmark from two text elements is what made
  // "COLLECTION" collide with "NOIR". It is a single supplied image, and only
  // its height is set, so the artwork is never squashed or cropped.
  assert.match(rule(sheet, ".lockup img"), /height:\s*44px/);
  assert.match(rule(sheet, ".lockup img"), /width:\s*auto/);

  // Section 3 sets the footer's left column as an eyebrow and an address.
  // The wordmark already sits at the top of every page, and a second one at
  // the foot repeats the brand rather than closing the page.
  const { html } = await page("/");
  assert.ok(
    !html.includes("site-footer__lockup"),
    "the footer still carries a second wordmark",
  );
  assert.match(html, /site-footer__eyebrow">Collection Noir</);
});

test("the navigation sits on one baseline", async () => {
  const sheet = await css();
  // The italic current-page cut used to build a taller line box and knock
  // itself off its neighbours' baseline.
  assert.match(rule(sheet, ".site-nav a"), /line-height:\s*1/);
  assert.match(rule(sheet, ".site-nav"), /gap:\s*40px/);
});

test("the Atelier menu survives the cursor travelling into it", async () => {
  const sheet = await css();
  // The trigger's padding bridges the gap the panel is offset by, so the
  // pointer never crosses a dead band on its way down to the menu.
  const trigger = rule(sheet, ".site-nav__item > a");
  assert.match(trigger, /padding-bottom:\s*18px/);
  assert.match(trigger, /margin-bottom:\s*-18px/);
  assert.match(rule(sheet, ".site-nav__menu"), /margin-top:\s*18px/);
});

test("the Atelier trigger is announced as a menu and reachable by keyboard", async () => {
  const { html } = await page("/");
  assert.match(html, /aria-haspopup="true"/, "the trigger claims no popup");
  assert.match(html, /aria-expanded="(true|false)"/, "the trigger has no expanded state");
});

test("the Atelier item stays current while reading Materials", async () => {
  const { html } = await page("/atelier/materials");
  assert.match(html, /href="\/atelier"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/atelier"/);
});

test("the footer carries the way in to the console", async () => {
  const { html } = await page("/");
  assert.match(html, /href="\/admin"[^>]*>Admin</);
});

test("the homepage hero carries the mockup copy", async () => {
  const { html } = await page("/");
  assert.match(html, /hero__eyebrow">London Design\. Italian Craft\./);
  // The approved design breaks the headline after "in its".
  assert.match(html, /<h1>Material <em>in its<\/em><br\/>purest form<\/h1>/);
  assert.match(
    html,
    /hero__tagline">Each piece is made once, made properly, and made to last\./,
  );
  assert.match(html, /View the Collection/);
  assert.match(
    html,
    /class="statement"/,
    "the centred italic statement section 4.2 asks for",
  );

  // Section 4.1 sets one frame, held still. A carousel is the loudest thing
  // a page like this could do, and the specification does not ask for one.
  assert.ok(!html.includes("hero__arrow"), "the hero still carries carousel controls");
});

test("the hero is a photograph band, not a wash", async () => {
  const sheet = await css();
  const hero = rule(sheet, ".hero");
  assert.match(hero, /height:\s*560px/);
  // While the photograph is missing the band is the letterbox mount, so an
  // unwired hero reads as an empty frame rather than as a styling error.
  assert.match(hero, /background-color:\s*var\(--cn-letterbox\)/);
  assert.doesNotMatch(hero, /linear-gradient/, "the hero band itself is a gradient");
  const frame = rule(sheet, ".hero__frame");
  assert.match(frame, /background-size:\s*cover/);
  // `center` and `50%` are the same value; which one is served depends on
  // the minifier, so both are accepted.
  assert.match(frame, /background-position:\s*(center|50%) 40%/);
});

test("the hero copy sits left centred and bottom right", async () => {
  const sheet = await css();
  const lead = rule(sheet, ".hero__lead");
  assert.match(lead, /left:\s*var\(--cn-page-padding\)/);
  assert.match(lead, /top:\s*50%/);
  const aside = rule(sheet, ".hero__aside");
  assert.match(aside, /right:\s*var\(--cn-page-padding\)/);
  assert.match(aside, /bottom:\s*44px/);
  const { html } = await page("/");
  assert.match(html, /class="hero__lead"/);
  assert.match(html, /class="hero__aside"/);
});

test("the homepage teaser links into the top categories", async () => {
  const { html } = await page("/");
  // The approved design sets the category as a tracked eyebrow on this grid,
  // with a piece named beneath it where one is published.
  const eyebrows = [...html.matchAll(/category-card__eyebrow">([^<]+)/g)].map((m) => m[1]);
  assert.deepEqual(eyebrows, ["Dining Tables", "Coffee Tables", "Console Tables"]);
});

test("the teaser frames at 4:5 and carries no View line", async () => {
  const { html } = await page("/");
  const teaser = html.slice(html.indexOf("category-grid"), html.indexOf("</section>", html.indexOf("category-grid")));
  const ratios = new Set(
    [...teaser.matchAll(/category-image ratio-([0-9-]+)/g)].map((m) => m[1]),
  );
  assert.deepEqual([...ratios], ["4-5"], "homepage teasers frame at 4:5");
  assert.ok(!teaser.includes("category-card__view"), "a View line is under a teaser card");
});

test("the materials page is a four column grid of 3:2 tiles", async () => {
  const sheet = await css();
  assert.match(rule(sheet, ".material-list"), /grid-template-columns:\s*repeat\(4,\s*1fr\)/);
  assert.match(rule(sheet, ".material-list"), /gap:\s*30px 26px/);
  assert.match(rule(sheet, ".material-card__image"), /aspect-ratio:\s*3\s*\/\s*2/);
});

test("materials are grouped Stone, Timber, Metal, each under a ruled label", async () => {
  const { html } = await page("/atelier/materials");
  const labels = [...html.matchAll(/material-group__label">([^<]+)/g)].map((m) => m[1]);
  assert.deepEqual(labels, ["Stone", "Timber", "Metal"]);
  const sheet = await css();
  assert.match(
    rule(sheet, ".material-group__label"),
    /border-bottom:\s*var\(--cn-hairline-weight\) solid var\(--cn-hairline\)/,
  );
});

test("a material attribute line is separated by a middot", async () => {
  const { html } = await page("/atelier/materials");
  const attributes = [...html.matchAll(/material-card__meta">([^<]+)/g)].map((m) => m[1]);
  assert.ok(attributes.length > 0, "no material carries an attribute line");
  for (const line of attributes) {
    assert.ok(!line.includes(" - "), `"${line}" uses a hyphen rather than a middot`);
  }
  assert.ok(
    attributes.some((line) => line.includes("·")),
    "no attribute line uses a middot",
  );
});

test("the trade form sits on Ivory, with no tinted band", async () => {
  const sheet = await css();
  assert.doesNotMatch(
    rule(sheet, ".register-panel"),
    /background/,
    "the trade form still sits on a tinted panel",
  );
  // A structural rule separates the intro from the form. It closes the intro
  // rather than opening the form, section 10, so the eight fields and the
  // invitation above them read as one block.
  assert.match(
    rule(sheet, ".trade-intro"),
    /border-bottom:\s*var\(--cn-hairline-weight\) solid var\(--cn-hairline\)/,
  );
  // Set as a call to action rather than as an eyebrow or a serif heading.
  const title = rule(sheet, ".register-panel__title");
  assert.match(title, /font-size:\s*var\(--cn-size-cta\)/);
  assert.match(title, /letter-spacing:\s*var\(--cn-track-26\)/);
});

test("the founder block is a portrait beside a pull quote", async () => {
  const sheet = await css();
  assert.match(rule(sheet, ".founder"), /gap:\s*34px/);
  assert.match(rule(sheet, ".founder__portrait"), /width:\s*92px/);
  // Italic at body size, section 8. What separates the quote from the
  // paragraph above it is the italic cut and the 26em measure, not size.
  assert.match(rule(sheet, ".founder blockquote"), /font-size:\s*var\(--cn-size-body\)/);
  assert.match(rule(sheet, ".founder blockquote"), /font-style:\s*italic/);
});

test("As Seen In and its press row are both centred", async () => {
  const sheet = await css();
  assert.match(rule(sheet, ".centred-row"), /text-align:\s*center/);
  assert.match(rule(sheet, ".press-row"), /justify-content:\s*center/);
  const { html } = await page("/atelier");
  const block = /centred-row[\s\S]*?<\/ul>/.exec(html);
  assert.ok(block, "the press row is not inside the centred block");
  assert.match(block[0], /As Seen In/);
});

test("no text anywhere renders in browser default link blue", async () => {
  const sheet = await css();
  // Both states are set globally. Leaving either to the user agent stylesheet
  // is what put default blue on the address and the email.
  const link = rule(sheet, "a");
  assert.match(link, /color:\s*var\(--cn-ink\)/);
  assert.ok(
    rule(sheet, "a:visited").includes("color"),
    "the visited state is left to the user agent stylesheet",
  );
  assert.match(rule(sheet, "a:hover"), /color:\s*var\(--cn-bark\)/);
});

test("form fields are an underline only, on the specified colour", async () => {
  const sheet = await css();
  const field = rule(sheet, ".field input");
  assert.match(field, /border:\s*0/);
  assert.match(field, /border-bottom:\s*var\(--cn-hairline-weight\) solid var\(--cn-field\)/);
  // `none`, `0 0` and `transparent` all mean no background here.
  assert.match(field, /background:\s*(none|0 0|transparent)/);
  const focused = rule(sheet, ".field input:focus");
  assert.match(focused, /outline:\s*0/);
  assert.match(focused, /border-bottom-color:\s*var\(--cn-ink\)/);
});

test("the enquiry left column is indented off the viewport edge", async () => {
  const sheet = await css();
  assert.match(rule(sheet, ".enquire__left"), /padding:\s*48px 24px 80px 96px/);
  assert.match(rule(sheet, ".enquire__right"), /padding:\s*48px 48px 80px 40px/);
  // The balance sits on the named measure, section 11.1, alongside the 44em
  // cap it exists to work with: the invitation has to set as two roughly
  // equal lines rather than four ragged ones.
  assert.match(rule(sheet, ".measure-invitation"), /text-wrap:\s*balance/);
});

test("the Instagram link opens the studio account in a new tab", async () => {
  const { raw } = await page("/");
  const link = /<a[^>]*instagram\.com\/collectionnoir[^>]*>/i.exec(raw);
  assert.ok(link, "the footer does not link to the studio account");
  assert.match(link[0], /target="_blank"/);
  assert.match(link[0], /rel="[^"]*noopener/);
  assert.match(link[0], /rel="[^"]*noreferrer/);
});

test("the collection overview shows six tiles", async () => {
  const { html } = await page("/collection");
  assert.match(html, /Every piece, made to order/);
  const names = [...html.matchAll(/category-card__name">([^<]+)/g)].map((m) => m[1]);
  assert.deepEqual(names, [
    "Dining Tables",
    "Coffee Tables",
    "Console Tables",
    "Side Tables",
    "Bedside Tables",
    "Plinths",
  ]);
});

test("a category page carries a breadcrumb, description and tab row", async () => {
  const { html } = await page("/collection/dining-tables");
  assert.match(html, /class="crumbs"/);
  assert.match(html, /Each piece is designed in London and made by hand in Italy/);
  assert.match(html, /class="category-tabs"/);
  const tabsMatch = /category-tabs[\s\S]*?<\/nav>/.exec(html);
  assert.ok(tabsMatch, "no category tab row on the page");
  const tabs = tabsMatch[0];
  for (const [slug] of CATEGORIES) {
    assert.ok(tabs.includes(`/collection/${slug}`), `tab row is missing ${slug}`);
  }
  // The current tab is marked with aria-current. Attribute order is decided by
  // the renderer, so the assertion does not depend on it.
  const current = /<a[^>]*aria-current="page"[^>]*>([^<]+)<\/a>/.exec(tabs);
  assert.ok(current, "no tab is marked as the current page");
  assert.equal(current[1], "Dining Tables");
});

test("a short category fills its trailing cell with a bespoke prompt", async () => {
  for (const slug of ["console-tables", "plinths"]) {
    const { html } = await page(`/collection/${slug}`);
    assert.match(html, /class="grid-prompt"/, slug);
    assert.match(html, /Begin a bespoke enquiry/, slug);
  }
});

test("the product page matches figure 3", async () => {
  const { html } = await page("/collection/dining-tables/roma");
  assert.match(html, /product__eyebrow">Dining Tables/);
  assert.match(html, /product__title">Roma</);
  assert.match(html, /product__subtitle">Dining table</);
  assert.match(html, /Starting from £6,750/);
  // Twice: under the price and inside the bespoke box. Section 7.4.6.
  assert.equal(
    (html.match(/class="cta"[^>]*>Enquire</g) ?? []).length,
    2,
    "the product page does not carry the Enquire call to action twice",
  );
  // The material shown, as the approved design sets the caption.
  assert.match(html, /MARQUINA — SHOWN/);
  assert.match(html, /product__material-label">Material</);
  assert.match(html, /swatch__name[^>]*>MARQUINA</);
  assert.match(html, /panel__label">Bespoke Commissions</);

  const labels = [...html.matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => m[1]);
  const values = [...html.matchAll(/<dd>([^<]+)<\/dd>/g)].map((m) => m[1]);
  assert.deepEqual(labels, ["Diameter", "Diameter", "Height", "Base", "Lead time", "Made"]);
  assert.deepEqual(values, [
    "D1.3m (4-6 seats)",
    "D1.6m (6-8 seats)",
    "H75cm",
    "Detachable pedestal",
    "12-16 weeks",
    "To order, in Italy",
  ]);
});

test("the swatch row renders one swatch per finish", async () => {
  const { html } = await page("/collection/dining-tables/roma");
  // Each swatch is named beneath it by the distinguishing word of the
  // material, uppercase, which is how the approved design labels the row.
  const names = [...html.matchAll(/swatch__name"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(names, ["MARQUINA", "VIOLA", "VERDE", "CLASSIC"]);
  const colours = [...html.matchAll(/background-color:\s*([^;"]+)/g)].map((m) => m[1].trim());
  assert.equal(colours.length, 4, "every finish needs a swatch colour");
});

test("both documents are offered on a product page", async () => {
  const { html } = await page("/collection/dining-tables/roma");
  assert.match(html, /href="\/spec-sheets\/roma-spec-sheet\.pdf"/);
  assert.match(html, /href="\/care-guides\/collection-noir-care-guide\.pdf"/);
  assert.match(html, /download__title"[^>]*>Specification Sheet</);
  assert.match(html, /download__title"[^>]*>Care Guide</);
});

test("the spec sheet and care guide actually download as PDFs", async () => {
  for (const path of [
    "/spec-sheets/roma-spec-sheet.pdf",
    "/spec-sheets/oria-plinth-spec-sheet.pdf",
    "/care-guides/collection-noir-care-guide.pdf",
  ]) {
    const response = await fetch(`${SITE}${path}`);
    assert.equal(response.status, 200, path);
    const head = Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString();
    assert.equal(head, "%PDF-", `${path} is not a PDF`);
  }
});

test("a paired piece cross references its partner", async () => {
  const { html } = await page("/collection/coffee-tables/otis-coffee");
  assert.match(html, /class="pairing"/);
  assert.match(html, /pairing__label">Part of a pair</);
  assert.match(html, /href="\/collection\/side-tables\/otis-side"[^>]*>Otis, side table</);
});

test("Ida states that its finish is a fixed pairing", async () => {
  const { html } = await page("/collection/coffee-tables/ida");
  assert.match(html, /fixed pairing of materials/);
});

test("the footer carries the studio, legal links, mailing list and Instagram", async () => {
  const { html } = await page("/");
  const footer = html.slice(html.indexOf("site-footer"), html.indexOf("</footer>"));
  // An en dash in the number range, not a hyphen. Section 3 names it.
  assert.match(footer, /132–134 Lots Road, Worlds End Studios/);
  assert.match(footer, /Unit 124, SW10 0RJ/);
  // Ampersands, section 3. HTML-escaped in the served markup.
  for (const link of [
    "Terms &amp; Conditions",
    "Shipping &amp; Delivery",
    "Returns &amp; Cancellations",
    "Privacy Policy",
  ]) {
    assert.ok(footer.includes(link), `footer is missing ${link}`);
  }
  assert.match(footer, /Join our mailing list/);
  assert.match(footer, /Instagram/);
  assert.match(footer, /site-footer__tagline">London Design\. Italian Craft\./);
});

test("the footer appears on every page, per section 10", async () => {
  for (const route of ["/", "/collection", "/collection/dining-tables/roma", "/trade", "/enquire"]) {
    const { html } = await page(route);
    assert.match(html, /Join our mailing list/, `${route} footer is missing the mailing list`);
    assert.match(html, /Instagram/, `${route} footer is missing Instagram`);
  }
});

test("the atelier page matches figure 9", async () => {
  const { html } = await page("/atelier");
  assert.match(html, /Designed in London,/);
  assert.match(html, /<em>Italian hands<\/em>/);
  assert.match(html, /founder__name">Samantha Santini</);
  assert.match(html, /A working relationship,/);
  assert.match(html, /class="press-row"/);
  assert.match(html, /Register for Trade Access/);
  assert.match(html, /View Materials/);
  assert.match(html, /View Care Guide/);
});

test("the trade page matches figure 10", async () => {
  const { html } = await page("/trade");
  assert.match(html, /A studio built/);
  assert.match(html, /<em>working with designers<\/em>/);
  assert.match(html, /Trade Pricing/);
  assert.match(html, /Complimentary Bespoke Design/);
  assert.match(html, /Specification Support/);
  for (const label of [
    "First Name",
    "Last Name",
    "Studio Name",
    "Email",
    "Website",
    "Company Reg. Number",
    "VAT Number",
    "Registered Address",
  ]) {
    assert.ok(html.includes(label), `trade form is missing ${label}`);
  }
  assert.match(html, />Register</);
});

test("the enquiry page matches figure 11", async () => {
  const { html } = await page("/enquire");
  assert.match(html, /Begin a conversation/);
  assert.match(html, /class="enquire__left"/);
  for (const label of [
    "First Name",
    "Last Name",
    "Email",
    "Phone (Optional)",
    "Location",
    "Tell us about your enquiry",
  ]) {
    assert.ok(html.includes(label), `enquiry form is missing ${label}`);
  }
  assert.match(html, />Send Enquiry</);
  assert.match(html, /info@collectionnoir\.com/);
  assert.match(html, /Appointment Only/);
  assert.match(html, /No marketing\s+lists, no third parties/);
});

test("an enquiry from a product page arrives attached to the piece", async () => {
  const { html } = await page("/enquire?piece=dining-tables/roma");
  assert.match(html, /panel__label">Regarding</);
  assert.match(html, /Roma, dining table/);
  assert.match(html, /Remove and enquire generally/);
});

test("the product page links into the enquiry with the piece attached", async () => {
  const { html } = await page("/collection/dining-tables/roma");
  assert.match(html, /href="\/enquire\?piece=dining-tables\/roma"/);
});

// ------------------------------------------------------------- accessibility

test("images carry alternative text", async () => {
  const { html } = await page("/collection/dining-tables");
  const frames = [...html.matchAll(/role="img"[^>]*>/g)].map((m) => m[0]);
  assert.ok(frames.length > 0);
  for (const frame of frames) {
    assert.match(frame, /aria-label="[^"]+"/, "a grid frame has no accessible name");
  }
});

test("every page has one h1 and a skip link", async () => {
  for (const route of ["/", "/collection", "/collection/dining-tables/roma", "/atelier", "/trade"]) {
    const { html } = await page(route);
    assert.equal((html.match(/<h1/g) ?? []).length, 1, `${route} should have exactly one h1`);
    assert.match(html, /class="skip-link"/, `${route} has no skip link`);
  }
});

test("the document language is British English", async () => {
  const { raw } = await page("/");
  assert.match(raw, /<html lang="en-GB"/);
});
