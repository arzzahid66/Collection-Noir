# Pending changes

The build log the brief asks for: every place the build departs from a
specification, resolves a contradiction between two of them, or leaves a gap
for the brand team to close. Five entries here were already being cited by
comments in the code before this file existed, which is why it now does.

Each entry says what the source documents said, what was done, and what is
still owed.

---

## Open, waiting on the client

### Product count
The Content Upload Checklist says fourteen launch products, the Build Brief
says twelve, and both list thirteen names. The seed carries fourteen priced
pieces plus Kaia unpriced. One authoritative number is needed before launch.

### Ida
The checklist flags Ida as excluded pending an unresolved image issue. The
seed has it live at 6,400 pounds with full copy. A status change in the
console is undone by the next seed run, so if the exclusion is permanent it
belongs in seed.py rather than in the console.

### Bedside Tables at launch
Kaia is the only bedside piece and it is paused, so the category renders a
tile on the collection index with no pieces behind it. Either hide the
category or accept the empty tile.

### Two categories held hidden
The seed carries chest-of-drawers and dressing-tables-and-desks as hidden
rows. Section 05 names six categories and figure 2 shows six tiles; these two
came from a separate build brief. Kept rather than deleted so nothing is lost
if the client confirms them.

### Material provenance gaps
Provenance is stated by quarry and region where it is known. Cipollino Verde,
Breccia Versilia and Onyx have the field left empty rather than filled with a
plausible guess.

### Materials intro wording
The checklist gives "Every Collection Noir piece begins with a material, not a
drawing." The seeded materials-intro record uses different approved wording.
One of the two is current.

### Typeface for micro labels
The Build Brief permits a generic system sans for uppercase micro labels. The
build sets them in Cormorant Light, and the client's mailing list review asked
for that block to follow the site's own type, which is the same instruction.
Cormorant stands until the client says otherwise.

### Type scale
Three tokens sit outside the bands the Build Brief states: body copy is 15px
against a stated 12 to 14, form success messages are 16px, and the collection
index title is 26px. Body size carries prices with it, so a change here moves
more than paragraphs.

### Stated tech stack
The Build Brief specifies Python with Jinja2 templates deployed to Netlify,
with no JS framework. The build is Next.js with React and a FastAPI backend,
deployed to Vercel. The client has audited and approved the live build, so the
brief is presumed stale on this point.

---

## Decisions taken

### Placeholders no longer wait on the catalogue
Three photography mounts sat inside conditionals gated on records the API
supplies, so with the backend unreachable the frames did not render at all and
the approved layout collapsed to its headings. The gates now sit on the parts
the records actually own. The hero also gained the empty slot label every
other frame already had.

### TODO(client) markers are not shown to visitors
Page bodies carry TODO(client) markers where a business fact is still
outstanding. The console shows them, and should. The public site now drops any
block containing one, because a legal page that publishes its own unanswered
questions is worse than one that says it is being prepared. The whole block
goes rather than the marked sentence: half these markers finish a sentence
rather than stand alone, so cutting the sentence would leave "Registered
company number:" with nothing after it.

### Every page record is reachable in the console
The Pages panel grouped by a hardcoded list of slugs, and three records were
missing from it: atelier-founder, atelier-designers and atelier-press. All
three render on the atelier page, so the founder's quote, the For Designers
copy and the placeholder publication names under "As seen in" had no way of
being edited. The atelier pages are now matched by prefix, and a catch all
group holds anything the named groups do not claim, so a page cannot be live
and uneditable at the same time again.

### Materials can be added from the console
The create endpoint and its client method both existed and nothing called
them, so the library was fixed at whatever the seed had put there. Burr
Walnut, Poplar Burl Veneer and Walnut Burl Veneer are named in the checklist,
absent from the seed, and there was no way to add them.

### The mailing list block is set in the site's own type
A previous revision loaded Jost for this one block, reading the client's
reference as a serif heading over a geometric sans. The client settled it the
other way: the block follows the same rules, fonts and formatting as the rest
of the site. The font and its two tokens were removed, and the one typeface
rule holds everywhere again. The header is the eyebrow that labels Showroom
and Contact, the invitation is italic Cormorant, and the field is the standard
field row with a text only submit on the end of its rule.

### The mailing list rule was shortened
At 44em the rule ran 660px under a 251px sentence, better than twice the width
of the copy it belongs to, and read as a rule across the page rather than the
underline of a field. Now 26em, a touch wider than that sentence.

### One card title size across the site
Section 14 records the locked file as setting 20px on the homepage teaser and
the materials card but 15px on the collection card, the category grid piece
name and the founder name, and asks for a decision rather than letting the two
drift. The decision is 20px, which section 14 names as the intended value.

### Starting from, in both places
Section 09 sets "Starting from" on category grids and allows either that or
"From" on product pages. The approved design sets "Starting from" in both, and
the client has confirmed the approved design is authoritative, so both
prefixes read the same.

### Ink and Umber swapped register
The correction brief sets Ink at #1C1714, the warm near black carrying all
body text and headings, and Umber at #2B2722 for the footer ground. The
Website Build Specification had them the other way round, and the copy lint
banned #1C1714 by name as a value the brand had moved away from. The brief is
authoritative, so the lint was updated rather than the colour.

---

## Not yet done

### The backend is not deployed
The FastAPI source exists only on the backend-r2-email-deploy branch. There is
no deploy configuration on any branch and no start command that honours a
platform port variable. Until it is deployed and API_BASE_URL is set in
Vercel, every content page reads as being prepared regardless of what the
database would hold.

### The founder portrait cannot be uploaded
The mount on the atelier page is a fixed empty div. Making it data driven
needs an image on the page record, which is a schema change and a migration,
so it belongs with the backend work rather than ahead of it.

### Products cannot be created or deleted from the console
The create and delete methods exist and no UI calls them. Not needed for
launch, since all fourteen pieces are seeded, but it means a new piece needs a
developer.

### Spec sheets regenerate from the command line only
A price or dimension edited in the console does not update the attached PDF on
its own.
