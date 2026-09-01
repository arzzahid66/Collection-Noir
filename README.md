# Collection Noir

London Design. Italian Craft.

Static-feeling marketing site for an atelier working in marble, solid timber
and hand worked metal. Every piece is made to order.

- **Frontend** Next.js 16, App Router, TypeScript, plain CSS
- **Backend** FastAPI, SQLAlchemy, Alembic
- **Database** Neon Postgres
- **Photography** Cloudflare R2, with Postgres as the fallback
- **Enquiry mail** Resend, optional

Catalogue data, photography and page copy live in the database and are edited
through the admin console at `/admin`. Nothing is hardcoded in markup, so a
price change or a new photograph needs no redeploy.

---

## Running it locally

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows
# source .venv/bin/activate     # macOS and Linux
pip install -r requirements.txt
```

Copy `.env.example` to `backend/.env` and fill in:

- `DATABASE_URL` from the Neon dashboard, Connection Details, pooled string,
  keeping `?sslmode=require`. Change the scheme prefix to
  `postgresql+psycopg://`.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD`, the single administrator login.
- `SESSION_SECRET`, generated with
  `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

Optional, and everything works without them:

- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` and
  `R2_PUBLIC_BASE_URL` put photography in Cloudflare R2 instead of in
  Postgres. Leave them empty and the binaries stay in the database exactly as
  before. See "Photography" below.
- `RESEND_API_KEY`, `ENQUIRY_NOTIFY_TO` and `ENQUIRY_NOTIFY_FROM` email each
  enquiry to the studio. Without the key an enquiry is still recorded and
  visible in the console; nothing fails, and no mail is sent.

Create the schema and seed the structure:

```bash
alembic upgrade head
python -m app.seed
```

`alembic upgrade head` builds the schema from empty. Run it before the seed on
a new database.

This creates the six categories with their aspect ratios, the thirteen
materials, the standing page copy, and the full launch catalogue from section 08.
Re-running is safe.

Then generate the specification sheets, one PDF per piece with slug based
filenames in `frontend/public/spec-sheets/`, plus the shared care guide:

```bash
python -m app.spec_sheets
```

Start it:

```bash
uvicorn app.main:app --reload
```

The API is on `http://127.0.0.1:8000`, with interactive documentation at
`/docs`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The site is on `http://localhost:3000`. `/api` is proxied to FastAPI, so every
request including image binaries is same origin.

### 3. Sign in

Go to `http://localhost:3000/admin` and sign in with `ADMIN_EMAIL` and
`ADMIN_PASSWORD`.

---

## Publishing a piece

All fourteen launch pieces carry their confirmed prices, editorial copy,
dimensions, bases, lead times and finishes from section 08 of the specification.
Re-running the seed reapplies them, so the document stays the source of truth
for catalogue content. Photography and sort order belong to the console and are
never overwritten.

No photography has been supplied, so no piece is publishable yet.

A piece appears on the public site only when all three are true:

1. status is `live`
2. it has a confirmed price, or `pricing_status` is `poa`
3. it has at least one attached photograph

A piece failing any of these is withheld from the grid entirely and 404s on
direct access. This is deliberate: no price on application is used at launch,
so an unpriced piece is held back rather than shown without a price. It is also
how Kaia, the paused bedside table, stays off the site while remaining in the
data model.

To publish: **Images** to upload, then **Pieces** to set the price, attach the
photograph, add materials, and set the status to live.

---

## Category images, the part that matters

This is the area the build brief identifies as the largest previous source of
rework, so the rules are enforced in code rather than left to convention.

**Aspect ratio is per category, never global.** It is stored on the category
row and editable under **Categories**.

| Category | Ratio |
| --- | --- |
| Dining Tables | 3:2 landscape |
| Coffee Tables | 3:2 landscape |
| Console Tables | 4:5 portrait |
| Side Tables | 4:5 portrait |
| Bedside Tables | 4:5 portrait |
| Plinths | 4:5 portrait |

**Nothing is ever cropped.** Images are stored byte for byte as uploaded and
rendered with `background-size: contain`. There is no computer vision, no
background subtraction and no automatic cropping anywhere in this codebase.
An image whose shape does not match its frame is centred on the mount colour
`#F0ECE3` with clean margin. A visibly smaller piece with clean margin is
always preferable to one with its edge cut off.

**The ratio badge.** The admin image panel compares each photograph's natural
ratio against its category target. Within five per cent it reads green and the
image will sit close to edge to edge. Beyond that it reads amber and the image
will letterbox visibly. Amber is not a bug: it means the source photography was
framed differently, and the fix is a reshoot rather than anything in the code.

Test the grid with real photography early. The gap between a mockup with
placeholders and the same grid with actual product photography is where the
problems appear.

---

## Photography

Binaries live in Cloudflare R2. They used to live in Postgres as `bytea`, and
they still can: the two are decided per row by `images.storage_key`, and both
are read through the same URL contract, so the catalogue can be moved a
photograph at a time with nothing breaking in between.

The change was forced by the free tier. Neon allows 0.5 GB of storage and 5 GB
of egress a month, which at a couple of megabytes a photograph is roughly two
and a half thousand image views. R2 gives 10 GB and charges nothing for
egress, and its free tier does not expire after a year the way S3's does.

Set the five `R2_*` variables, then move what is already in the database:

```bash
python -m app.migrate_images --dry-run
python -m app.migrate_images
```

Resumable and idempotent. It commits one row at a time and only looks at rows
that still hold their bytes, so a re-run after any failure continues where it
stopped. Each object is read back and size checked before the database copy is
cleared, because that is the moment a photograph could otherwise be lost.

With `R2_PUBLIC_BASE_URL` set, the API hands the browser the bucket URL and
the photograph never touches the API host or Neon. Without it, `/api/images/
{id}` redirects to the bucket instead. Either way the frontend is unchanged:
it renders whatever `url` says, which is why this migration needed no
component edits.

R2 speaks the S3 API, so `R2_ENDPOINT` will point the same code at S3, MinIO
or a local emulator.

---

## Pricing

Format is `Starting from £X,XXX`: pounds sterling, comma thousands separator,
no decimals.

Nothing in the template rounds or reformats. Launch prices are already round
numbers ending in zero as a business rule on the source data, and rounding in
the template could contradict what the console holds.

`pricing_status: "poa"` exists in the model for future flexibility. It is not
used at launch.

---

## The two calls to action

Product pages have two branches, decided by the `purchasable` flag:

- `false` renders **Enquire**, linking to the enquiry form with the piece
  already attached. **Every launch piece uses this.**
- `true` renders **Add to Order**. Reserved for a future collection that is not
  ready.

There is no cart, no basket, no checkout and no payment provider in this  copy-lint-ok
codebase. `POST /api/orders` records intent and answers 501. That module is
where the work resumes when the next collection is ready, and it will need the
full distance-selling set alongside it.

---

## Tests

Four gates. Run all four before asking for a deploy.

```bash
node scripts/check-copy.mjs          # copy and palette rules
cd frontend && npm run typecheck     # TypeScript
cd backend  && pytest                # 83 checks
```

The end-to-end suite needs both services running, against a production build
rather than the development server. The development server drops workers under
the suite's concurrency, and a production build is what actually deploys:

```bash
# terminal 1
cd backend && uvicorn app.main:app --port 8010
# terminal 2
cd frontend && API_BASE_URL=http://127.0.0.1:8010 npm run build
cd frontend && API_BASE_URL=http://127.0.0.1:8010 npm start -- -p 3010
# terminal 3
node --test scripts/e2e.mjs          # 67 checks
```

Override the origin with `SITE_URL` to point the suite at a deployed site.

**`backend/tests/`** runs against a throwaway SQLite database seeded by the real
`app.seed`, so it asserts against the catalogue the site is built from rather
than a fixture that could drift. The section 08 table is transcribed into
`test_catalogue.py` as a literal instead of imported from the seed, so a mistake
in the seed cannot make its own test pass.

**`scripts/e2e.mjs`** asserts on the HTML and CSS a browser receives. That is the
only place some of the specification can be checked: section 07 is not "the
database holds a ratio per category", it is "the frame in the grid carries that
ratio and the photograph inside it is never cropped".

## Copy rules

Enforced by `node scripts/check-copy.mjs`, run from the repository root or via
`npm run check:copy` in `frontend`.

It fails on the prohibited lexicon, em dashes, exclamation marks, pure black,
pure white, the Instagram text card ground, and any colour hardcoded in a
stylesheet instead of referenced from `tokens.css`.

A line that states a rule rather than breaks it can be marked `copy-lint-ok`,
which keeps the exception explicit and greppable.

Always: material named before the piece, "enquire" not "contact", "commission"
not "buy", "piece" not "product", "client" not the retail alternative,
"atelier" not "studio", provenance by quarry and region.

---

## Where the source documents disagreed

Two client documents govern this build: the **Website Build Specification,
version 1.0, August 2026**, and the **approved design prototype**
(`Collection Noir.dc.html`).

Section 11 of the specification asked that any difference between the two be
flagged rather than resolved unilaterally. The client has since ruled: **the
approved design prototype is locked and takes precedence.** Where they
disagree, the prototype wins, and the specification still governs everything
the prototype does not cover. The resolutions below stand except where
revision 3 of `PENDING_CHANGES.md` records the prototype overriding them,
notably the detail page price wording and two uses of punctuation section 02
rules out.

A third document now sits above both: the **frontend correction brief**, which
states that the reference HTML is the source of truth and that where it and the
build disagree, the brief wins. Revision 4 applies it. It moves Ink, Umber,
Clay and the hairline, and it removes the sans the specification set body copy
in, so the two rows below and any type reference in section 03 read against it.

| Item | Resolution |
| --- | --- |
| Stack | Next.js and FastAPI. Section 04 names a static pipeline as the original but says a modern equivalent is equally acceptable, so long as content lives in structured data rather than hardcoded markup. It does |
| Typeface | Cormorant Garamond, and nothing else. Body copy, micro labels, prices and form fields included. Section 03's sans for body is superseded by section 1.1 of the correction brief |
| Ink | `#1C1714`, per the correction brief. Was `#2B2722` |
| Umber | `#2B2722`, per the correction brief. Was `#1C1814`, itself corrected from `#3B2F27` |
| Footer ground | Umber, per section 03 |
| Image ratio | Per category with `contain`, per the section 07 table. Never a site wide default, never `cover`, never a programmatic crop |
| Categories | Six, per section 05 and figure 2. The two from the earlier brief are hidden rather than deleted |
| Legal documents | Four, per section 05. The cookie policy is reached from the cookie banner instead |
| Purchase flow | Template built, disabled everywhere at launch. Section 02 rules out cart and basket language because nothing is held in stock |
| Price wording | "Starting from" in both the grid and the detail page, per section 09 and the approved design. Settled in revision 3; the detail page previously read "From" |
| Spec sheets | reportlab rather than WeasyPrint. WeasyPrint needs GTK system libraries that do not install on a plain Windows machine, and section 04 does not mandate it |

Every open discrepancy is listed under "Flagged for client decision" in
`PENDING_CHANGES.md`, with the reasoning for each.

---

## Still needed before launch

1. **Trader details** for the legal pages: registered company name, company
   number, registered address, VAT number, contact email. Search the page
   bodies for `TODO(client)`; the Pages panel flags every page that still has
   them.
2. **A CN monogram for the favicon.** The lockup itself has been supplied and
   is in place, dark in the header and light in the footer, under
   `frontend/public/brand/`. The tab icon is currently that same horizontal
   lockup letterboxed into a square, which reads faintly at 16px. The artwork
   was not cropped to fit, because the logo is locked.
3. **Confirmed prices and product photography**, entered through `/admin`.
4. **Hosting**: Next.js suits Vercel. FastAPI needs a separate host such as
   Render, Railway or Fly. Netlify's static model no longer fits now that the
   catalogue is dynamic.

---

## Deploy discipline

Log every change in `PENDING_CHANGES.md` before deploying. Batch changes into a
single deploy rather than deploying per commit; this project has hit free-tier
build-minute limits before. Hold every deploy for an explicit go-ahead.
