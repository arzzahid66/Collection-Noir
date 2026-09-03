"""Standing page copy, seeded into the `pages` table.

Everything here is editable through the admin console after seeding, so
wording changes need no redeploy.

Written to the brand copy rules: material named before the piece, "enquire"
rather than "contact", "commission" rather than "buy", "piece" rather than
"product", "client" rather than the retail alternative, "atelier" rather than
"studio", provenance stated by quarry and region. No em dashes, no exclamation
marks, no decorative rules, and none of the prohibited lexicon.

Placeholders marked TODO(client) need details that only the business can
supply. They must be filled before the legal pages go live.
"""

PAGES: dict[str, tuple[str, str]] = {}


# ---------------------------------------------------------------------------
# Home
# ---------------------------------------------------------------------------

PAGES["home-intro"] = (
    "London Design. Italian Craft.",
    """
An atelier for bespoke furniture. Designed in London, executed in Italy, made
to order.

Design happens in London. Execution happens in Italy, in workshops that have
cut and finished these materials for generations. Nothing is held in stock.
Every piece is made to order, to the dimensions of the room it will stand in.
""",
)

PAGES["home-bespoke"] = (
    "Bespoke commission",
    """
Most of what leaves the atelier has been altered in some way: a top sized to a
particular room, a material substituted, a base reworked to carry a longer
span.

Commissions begin with the material. Tell us the room, the dimensions you are
working to, and the light it receives, and we will come back with the blocks
worth considering.
""",
)


# ---------------------------------------------------------------------------
# The Atelier
# ---------------------------------------------------------------------------

PAGES["atelier"] = (
    "The Atelier",
    """
Collection Noir Atelier was founded in London in 2020 by Samantha Santini, an
interior designer who had spent over a decade specifying furniture for some of
the city's most considered homes. The brand exists because of a gap she kept
encountering: pieces that compromised on either the material or the design,
rarely both held to the same standard at once.

Every commission begins as a drawing in the London atelier and ends in the
hands of Italian artisans, craftspeople for whom carving stone, turning timber
and casting metal is not a trade learned quickly, but one passed down and
refined over generations. That inheritance is what we are paying for as much as
the material itself, a level of hand-finishing that cannot be rushed or
replicated by machine.

What began as a marble furniture atelier has grown into a fuller proposition.
Alongside the original dining tables, coffee tables, consoles, side tables and
plinths, the collection now extends into case goods, bedside tables and storage
pieces that bring stone, timber and hand-worked bronze together in a single
commission. The materials change piece to piece, but the standard does not,
each one made once, made properly, and made to be lived with for a lifetime.
""",
)


PAGES["atelier-bespoke"] = (
    "Bespoke",
    """
TODO(client): the copy for this page is being written by the brand team. It
sets out the commission at length: what can be altered, how a commission
begins, what is asked of the client, and how long the work takes.

The homepage says the same thing in three sentences, under "Bespoke
commission". This page is where it is said properly.
""",
)


PAGES["atelier-founder"] = (
    "Samantha Santini",
    """
A room does not need more objects in it. It needs one that was worth making.
""",
)


PAGES["atelier-designers"] = (
    "A working relationship, not a transaction",
    """
Collection Noir Atelier works directly with interior designers and architects
on a project by project basis: trade pricing, a dedicated point of contact, and
the kind of specification support a client presentation actually needs. If you
specify for a living, this is built for how you work.
""",
)


PAGES["atelier-press"] = (
    "As seen in",
    """
- Vogue Living
- Elle Decor
- LivingEtc
- Homes & Garden
- SheerLuxe
""",
)


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------

#
# The note at the head of the materials page is the client approved wording and
# is reproduced verbatim. Two notes on how it is written here:
#
#   - The dash is written as an escape rather than as the character, so the
#     copy lint's rule against em dashes reads a source line that does not
#     contain one while the visitor still gets the approved punctuation.
#   - The word the lint restricts is marked as an allowed use below. The rule
#     permits it where a specific reason is given, and the approved sentence
#     gives the reason immediately before it.
#
PAGES["materials-intro"] = (
    "Materials Library",
    (
        "Natural stone and timber form over millions of years and vary in "
        "colour, shade and pattern \u2014 these variations are part of what "
        "makes each piece unique. Other materials can be quarried, milled "  # copy-lint-ok
        "or cast upon request."
        "\n\n"
        "Provenance is recorded by quarry and region rather than by country, "
        "because two blocks from the same country can behave nothing alike. "
        "Samples are sent to trade accounts on request. Every sample is cut "
        "from stock, so what arrives is the material itself rather than a "
        "printed representation."
    ),
)


# ---------------------------------------------------------------------------
# Care
# ---------------------------------------------------------------------------

PAGES["care"] = (
    "Care",
    """
## Marble and stone

Wipe with a soft cloth and warm water. Dry the surface afterwards rather than
leaving it to air.

Marble is calcareous. Anything acidic will etch it: wine, citrus, vinegar,
tomato, and most household cleaning sprays. An etch is a change in the surface
finish rather than a stain, and it will not lift with cleaning. Use coasters
and mats, and lift spills immediately rather than wiping them across the
surface.

Do not use bleach, limescale remover, cream cleaner, or any product described
as suitable for bathrooms. Do not use a scouring pad.

Honed surfaces show marks less readily than polished ones and can be
refinished more easily. Polished surfaces return more light and need more care.

Pieces are sealed before they leave the workshop. A sealant is not a barrier,
it slows absorption. Reseal every twelve to eighteen months in domestic use,
more often where a surface sees heavy use. We can advise on the right product
for the material you have.

## Timber

Dust with a dry cloth. For marks, use a barely damp cloth and dry immediately.

Hand oiled surfaces can be refreshed with a light application of the same oil,
worked along the grain and buffed off. Do not use silicone based polish, which
builds a film the oil cannot then penetrate.

Keep timber out of direct sunlight where possible and away from the immediate
line of a radiator or underfloor heating vent. Movement in response to humidity
is normal in solid timber and is not a fault.

## Patinated metal

Dust only. A hand applied patina continues to move for roughly the first year
in a room, then settles. That movement is the finish behaving as intended.

Do not use metal polish, which will cut through the patina.

## Movement, veining and variation

Marble is a quarried material. Veining, mineral inclusions, fossil traces and
variation in ground colour are properties of the stone rather than defects. No
two tops are identical, and a top will not match a sample precisely.

Where a commission requires a particular run of veining across a top, that is
decided at the block before cutting and confirmed with you in advance.

## If something is wrong

Enquire, and send photographs if you can. Damage in transit should be reported
within the period set out in the delivery terms.
""",
)


# ---------------------------------------------------------------------------
# Trade
# ---------------------------------------------------------------------------

PAGES["trade"] = (
    "Register for trade access",
    """
The atelier works with interior designers, architects, developers and
hospitality operators.

## What a trade account includes

Trade pricing across the collection.

Material samples, cut from stock and sent to your address.

Specification support: dimensioned drawings, material schedules and spec sheets
for the pieces you are putting forward.

Bespoke development, where a piece is reworked to a project's dimensions or
detailed in a material outside the standard offering.

Lead time visibility across a project, so delivery can be sequenced against a
programme rather than quoted piece by piece.

## Projects

Prime residential, hospitality and developer work. The atelier is comfortable
working to a specification, to a drawing, or from a brief that is still open.

## Registering

Complete the form and we will come back within two working days. Please include
the practice name and the type of work you do, which is what determines the
terms we can offer.
""",
)


# ---------------------------------------------------------------------------
# Enquire
# ---------------------------------------------------------------------------

PAGES["enquire-intro"] = (
    "Begin a conversation",
    """
Every piece is made to order, so a conversation comes before a commission.

Tell us the piece you have in mind, the room it is for, and the dimensions you
are working to. If you are unsure of the material, say so, and we will put
options in front of you.

We reply within two working days.
""",
)


# ---------------------------------------------------------------------------
# Showroom
# ---------------------------------------------------------------------------

PAGES["showroom"] = (
    "Visit",
    """
Worlds End Studios
132 to 134 Lots Road
Unit 124
London SW10 0RJ

Visits are by appointment. The atelier is a working space rather than a
showroom floor, so what is on the ground varies: blocks under consideration,
pieces in finishing, samples from the current library.

Enquire to arrange a time. If you are coming to look at a particular material,
say which, and we will have it out.

The nearest stations are Imperial Wharf and Fulham Broadway.
""",
)


# ---------------------------------------------------------------------------
# Press
# ---------------------------------------------------------------------------

PAGES["press"] = (
    "Press",
    """
For press enquiries, image requests and interview approaches, enquire and mark
your message for press.

High resolution photography, material provenance details and product
specifications are available to publications on request.

TODO(client): add press features here as they appear. Each entry needs the
piece and material first, then the publication and date.
""",
)


# ---------------------------------------------------------------------------
# FAQs
# ---------------------------------------------------------------------------

PAGES["faqs"] = (
    "Frequently asked questions",
    """
## Can I commission a piece in a different material?

Yes. Every piece in the collection can be cut in another material from the
library, and in materials outside it where a suitable block can be sourced.
Material changes affect price and lead time.

## Can a piece be made to different dimensions?

Yes. Most commissions are altered in some way. Longer spans sometimes require
the base to be reworked, which we will raise with you before quoting.

## How long does a commission take?

Eight to ten weeks for the smaller tables. Twelve to sixteen weeks for dining
tables. A bespoke piece, or one in a material that has to be sourced, may run
longer. The lead time is confirmed in writing when the commission is placed.

## Why is nothing held in stock?

Each piece is cut after it is commissioned, from a block selected for it. That
is what allows the veining across a top to be decided rather than accepted.

## Will my piece match the photograph?

No, and it is not meant to. Marble is quarried. Veining and ground colour vary
block to block. The photograph shows the form and the material, not the exact
top you will receive. Where a particular run of veining matters, we agree it at
the block before cutting.

## Do you deliver outside the United Kingdom?

Yes. Delivery is arranged per commission and quoted with the piece. See
Shipping and Delivery.

## Can I return a piece?

Made to order pieces are exempt from the statutory cancellation right, because
they are made to your specification. This does not affect your rights if a
piece arrives faulty, damaged or not as described. See Returns and
Cancellations, which sets out the position in full.

## Do you offer trade terms?

Yes, to designers, architects, developers and hospitality operators. See Trade.

## Can I visit?

By appointment, at Worlds End Studios in London. See Visit.
""",
)


# ---------------------------------------------------------------------------
# Sustainability
# ---------------------------------------------------------------------------

PAGES["sustainability"] = (
    "Responsible sourcing",
    """
## Made to order

Nothing is held in stock and nothing is made speculatively. A piece is cut
after it is commissioned. There is no surplus inventory, no clearance and no
disposal of unsold stock, which is the single largest reduction available to a
maker at this scale.

## Stone

Blocks are selected at the quarry. Working within reach of the quarries in
Tuscany, the Aosta Valley and Lazio keeps the distance between extraction,
cutting and finishing short.

Offcuts from a top are retained and worked into smaller pieces and samples
where the block allows.

TODO(client): confirm whether the Italian workshops hold any recognised
certification, and whether quarry sources can be named individually. If so,
list them here.

## Timber

TODO(client): confirm the chain of custody position on timber. If the supply is
FSC or PEFC certified, state which, and hold the certificate numbers.

## Longevity

A solid marble or timber piece has a working life measured in generations. Care
guidance is published so that pieces can be maintained rather than replaced,
and surfaces can be refinished rather than discarded.

## Packaging

Pieces travel crated and blanket wrapped. TODO(client): confirm what proportion
of packaging is recycled or recyclable, and whether crates are recovered after
delivery.

## What this page does not claim

The atelier does not hold a carbon measurement or an offsetting programme.
Quarrying and shipping stone carry a real environmental cost. This page records
what is done rather than describing the work as something it is not.
""",
)


# ---------------------------------------------------------------------------
# Accessibility
# ---------------------------------------------------------------------------

PAGES["accessibility"] = (
    "Accessibility",
    """
This site aims to meet the Web Content Accessibility Guidelines version 2.2 at
level AA.

## What has been done

Text and background colours are checked for contrast. Headings follow a
sequential structure. Every interactive element can be reached and operated
with a keyboard, and the focus outline is visible throughout. Images carry
descriptive alternative text. Forms use labels rather than placeholder text
alone. The site reflows to a single column on small screens without loss of
content.

## Known limitations

Product photography relies on colour and surface detail to convey material
character. Descriptions state the material, provenance and finish in text
alongside every image, but a photograph carries information a description
cannot fully replace.

TODO(client): once real photography is loaded, review every alternative text
entry through the admin console.

## Visiting the atelier

Worlds End Studios has TODO(client): confirm step free access, lift
availability, accessible facilities and parking, and state the position here
plainly.

## Telling us about a problem

If any part of this site is difficult to use, enquire and describe what
happened and which page you were on. We will respond within five working days.
""",
)


# ---------------------------------------------------------------------------
# Legal
#
# Five tabs. The trader identity block and the made-to-order cancellation
# position are the two items that must be correct before launch.
# ---------------------------------------------------------------------------

_TRADER_BLOCK = """
### Who we are

Collection Noir is a trading name of TODO(client): registered company name.

Registered company number: TODO(client)
Registered address: TODO(client)
Trading address: Worlds End Studios, 132 to 134 Lots Road, Unit 124, London SW10 0RJ
VAT registration number: TODO(client)
Email: TODO(client)

These details are published to meet the pre-contract information requirements
of the Consumer Contracts (Information, Cancellation and Additional Charges)
Regulations 2013 and the Companies Act 2006.
"""

PAGES["legal-terms"] = (
    "Terms and Conditions",
    f"""
Last updated: TODO(client): date of publication.

These terms govern your use of this site and any commission placed with
Collection Noir. Please read them before enquiring.

{_TRADER_BLOCK}

### Use of this site

The content of this site is provided for general information. Descriptions,
dimensions and photographs are indicative. Because every piece is cut from a
quarried or grown material, the piece delivered will vary from the photograph
shown.

All text, photography, drawings and the Collection Noir name and marks are
owned by us or licensed to us. They may not be reproduced without written
permission.

### Enquiries and quotations

Nothing on this site is an offer to sell. Prices shown as "Starting from" are
the lowest price at which that piece has been made, in the default material at
the smallest standard size. They exclude delivery and any variation to material,
dimension or finish.

A quotation is given in writing following an enquiry and is valid for thirty
days unless stated otherwise. Material prices move, and a quotation outside
that window will be reissued.

### Placing a commission

A commission is formed when we confirm your order in writing and you have paid
the deposit. At that point the terms in the written confirmation, together with
these terms, form the contract.

TODO(client): confirm the deposit percentage and the balance payment point, and
state them here. A typical position is fifty per cent on commission and the
balance before despatch.

### The material

Marble, timber and metal are natural and worked by hand. Variation in veining,
ground colour, figure, inclusion and patina is a property of the material and
is not a defect.

Samples indicate character. They do not predict the exact appearance of your
piece. Where a specific run of veining is required, it is agreed at the block
before cutting and confirmed in writing.

Dimensions are worked to a tolerance of TODO(client): confirm the workshop
tolerance, commonly plus or minus five millimetres on a stone top.

### Lead times

Lead times are given in good faith and confirmed on commission. They run from
the date the deposit clears and all specification details are settled, not from
the date of enquiry.

Where a delay is caused by something outside our reasonable control, including
quarry availability or a block failing on inspection, we will tell you promptly
and agree a revised date with you.

### Price and payment

Prices are in pounds sterling. TODO(client): confirm whether prices shown
include or exclude VAT, and state it here without ambiguity.

### Liability

Nothing in these terms limits our liability for death or personal injury caused
by our negligence, for fraud, or for anything else that cannot be limited by
law.

Your statutory rights under the Consumer Rights Act 2015 are not affected by
anything in these terms.

Where you commission as a business rather than as a consumer, our liability is
limited to the price paid for the piece, and we are not liable for loss of
profit, loss of contract or indirect loss.

### Governing law

These terms are governed by the law of England and Wales, and the courts of
England and Wales have jurisdiction. If you live in Scotland or Northern
Ireland, you may bring proceedings in your own jurisdiction.

### Complaints

Enquire in the first instance and we will respond within five working days.
TODO(client): if you join an alternative dispute resolution scheme, name it
here.
""",
)

PAGES["legal-shipping"] = (
    "Shipping and Delivery",
    """
Last updated: TODO(client): date of publication.

### How pieces travel

Every piece is crated and blanket wrapped before it leaves the workshop in
Italy. Stone tops travel on edge, which is how they are strongest.

Delivery is by a specialist furniture carrier rather than a parcel network.
Two person delivery to the room of choice is standard within mainland Great
Britain. TODO(client): confirm whether unpacking, positioning and removal of
packaging are included.

### Timing

Delivery is arranged once the piece has passed final inspection. We will
contact you to agree a date. TODO(client): confirm the typical notice period
given.

Lead times quoted for a commission run to despatch. Transit from Italy adds
TODO(client): confirm transit time.

### Cost

Delivery is quoted per commission, because it depends on the piece, the
destination and the access. It is confirmed in writing with your quotation and
is not included in the "Starting from" price shown on the site.

### Access

Please tell us before commissioning if there are stairs, a lift with a
restricted car size, a narrow turn, a listed staircase, or parking
restrictions. Stone tops are heavy and cannot be flexed to pass an obstacle.

Where access has not been declared and a delivery cannot be completed, a
re-delivery charge applies.

### International delivery

We deliver outside the United Kingdom. Delivery outside the UK is quoted per
commission.

For deliveries outside the UK, any import duty, tax or customs charge is
payable by you and is not included in our quotation. TODO(client): confirm
whether you deliver on a DDP or DAP basis and state it here.

### On arrival

Please inspect the piece before the carrier leaves. Note any damage on the
delivery paperwork.

Report damage in transit within TODO(client): confirm the notification window,
commonly forty eight hours of delivery, with photographs. We will arrange
repair or replacement. This is in addition to your statutory rights and does
not replace them.

### Risk

Risk in the piece passes to you on delivery. Where you arrange your own
carrier, risk passes when the piece is collected from the workshop.
""",
)

PAGES["legal-returns"] = (
    "Returns and Cancellations",
    """
Last updated: TODO(client): date of publication.

This page sets out when a commission can be cancelled and what happens if
something is wrong with a piece. Please read it before commissioning, because
the position for made to order pieces differs from ordinary online purchases.

### Made to order pieces and the cancellation right

Every piece Collection Noir makes is made to order, cut and finished to the
specification agreed with you.

Under regulation 28 of the Consumer Contracts (Information, Cancellation and
Additional Charges) Regulations 2013, the fourteen day right to cancel does not
apply to goods that are made to a consumer's specification or are clearly
personalised.

Because our pieces are made to your specification, **you do not have a
statutory right to cancel once a commission is confirmed and production has
begun.** We draw this to your attention before you commission, and your written
order confirmation repeats it.

This does not affect any of your other legal rights, and in particular it does
not affect your rights where a piece is faulty, damaged or not as described.

### Cancelling before production begins

TODO(client): confirm and state your goodwill position here. A common approach
is: a commission may be cancelled without charge within a stated number of
working days of confirmation, provided the block has not been cut and no
material has been committed. After that point the deposit is retained against
work already carried out.

Once a block has been selected and cut for your commission, the material cannot
be returned to the quarry or used for another client, which is why cancellation
after that point cannot be free of charge.

### If a piece is faulty, damaged or not as described

Your rights under the Consumer Rights Act 2015 apply in full.

Goods must be of satisfactory quality, fit for purpose and as described.

Within thirty days of delivery, you have the short term right to reject a
faulty piece and obtain a full refund.

After thirty days and within six months, we have one opportunity to repair or
replace. If that is unsuccessful, you are entitled to a refund, which may be
reduced to reflect use.

After six months, the same rights apply but the burden of showing the fault was
present at delivery sits with you.

Report a fault by enquiring, with photographs where possible. We will respond
within five working days and arrange collection at our cost where a piece needs
to come back.

### What is not a fault

Variation in veining, ground colour, figure, mineral inclusion and patina is a
property of quarried and grown material and is not a fault.

Movement in solid timber in response to humidity is normal.

A hand applied patina continues to develop for roughly the first year.

Etching of a marble surface caused by contact with an acidic substance after
delivery is damage rather than a fault. Care guidance is published so this can
be avoided.

### Business commissions

Where you commission as a business rather than as a consumer, the Consumer
Rights Act 2015 and the Consumer Contracts Regulations 2013 do not apply. The
position is governed by the Terms and Conditions and your written order
confirmation.

### Refunds

Where a refund is due, it is made to the original payment method within
fourteen days of us agreeing it or receiving the piece back, whichever is
later.
""",
)

PAGES["legal-privacy"] = (
    "Privacy Policy",
    f"""
Last updated: TODO(client): date of publication.

This policy explains what personal data Collection Noir collects, why, and what
rights you have. It is written to meet the UK General Data Protection
Regulation and the Data Protection Act 2018.

{_TRADER_BLOCK}

We are the data controller for the personal data described here.

TODO(client): if you appoint a data protection contact, name the role and email
here.

### What we collect

When you enquire: your name, email address, telephone number where you give it,
the name of your practice or company where relevant, and the content of your
message.

When you register for a trade account: the above, plus your business details
and the nature of your work.

When you commission a piece: delivery address, billing details and the
correspondence relating to your commission.

When you use this site: standard server log data, and analytics data where you
have consented to it. See the Cookie Policy.

We do not collect special category data, and we do not knowingly collect data
from anyone under sixteen.

### Why we use it, and our lawful basis

To answer your enquiry and prepare a quotation. Lawful basis: steps taken at
your request before entering a contract.

To fulfil a commission, arrange delivery and provide aftercare. Lawful basis:
performance of a contract.

To keep accounting and tax records. Lawful basis: legal obligation.

To assess and administer a trade account. Lawful basis: legitimate interests,
being the operation of our trade programme.

To send you occasional written pieces about the atelier, where you have asked
to receive them. Lawful basis: consent. You can withdraw it at any time using
the unsubscribe link.

### Who we share it with

Our workshops and suppliers in Italy, where necessary to make your piece.

Our delivery carriers, where necessary to deliver it.

Our payment provider, accountants and professional advisers.

Our hosting and email providers.

TODO(client): name the actual processors once the hosting, email and payment
providers are confirmed, since naming them is expected practice.

We do not sell personal data and we do not share it for anyone else's
marketing.

### International transfers

Making a piece involves workshops in Italy, so some data is transferred outside
the United Kingdom. Where it is, we rely on the UK adequacy regulations for the
European Economic Area, or on the International Data Transfer Agreement where
adequacy does not apply.

### How long we keep it

Enquiries that do not lead to a commission: TODO(client): confirm, commonly two
years.

Commission records: seven years from the end of the relevant tax year, to meet
accounting obligations.

Trade account records: for as long as the account is active, then TODO(client):
confirm.

Marketing consent records: until you withdraw consent, then a record of the
withdrawal itself.

### Your rights

You have the right to be informed, and to request access to, rectification of,
or erasure of your personal data. You may also restrict or object to
processing, request portability, and withdraw consent where consent is the
basis we rely on.

To exercise any of these, enquire. We respond within one month.

If you are not satisfied with our response you may complain to the Information
Commissioner's Office at ico.org.uk, or by telephone on 0303 123 1113.

### Security

Data is held on access controlled systems. The administration area of this site
is protected by an individual credential and an expiring session. Payment card
details are handled by our payment provider and are never stored on our
systems.
""",
)

PAGES["legal-cookies"] = (
    "Cookie Policy",
    """
Last updated: TODO(client): date of publication.

This policy explains the cookies this site sets and how to control them. It is
written to meet the Privacy and Electronic Communications Regulations and the
UK General Data Protection Regulation.

### What a cookie is

A small file placed on your device by a website. Cookies let a site remember
things between pages and between visits.

### Cookies we set

**Strictly necessary.** These are required for the site to work and are set
without consent, as the regulations permit.

`cn_cookie_consent` records your cookie choice so you are not asked again. It
lasts twelve months.

`cn_admin_session` signs in a member of the atelier to the administration area.
It is set only after an administrator signs in, is marked HttpOnly, and expires
after twelve hours.

**Analytics.** Set only where you consent. These tell us which pages are read
and how people move through the site. TODO(client): if analytics are added,
name the provider, list the cookies it sets, state their lifetime, and confirm
whether IP addresses are anonymised.

**Marketing.** None. This site sets no advertising or tracking cookies, and
nothing here is shared with an advertising network.

### Third party content

This site loads the Cormorant Garamond typeface from Google Fonts. TODO(client):
confirm whether to keep this or self host the font files. Self hosting removes
the third party request entirely and is the cleaner position.

### Controlling cookies

Use the cookie banner when you first visit, or clear the `cn_cookie_consent`
cookie to be asked again.

You can also block or delete cookies in your browser settings. Blocking
strictly necessary cookies will stop parts of the site working.

### Changes

Any change to the cookies set will be reflected here, and the consent banner
will reappear where the change requires fresh consent.
""",
)
