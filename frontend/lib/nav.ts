export interface NavItem {
  href: string;
  label: string;
  /** Pages that hang off this item in the header menu. */
  children?: NavItem[];
}

/**
 * Primary navigation, section 2: Collection, Atelier, Trade, Enquire. Four
 * items, right aligned, in that order.
 *
 * Atelier is one item that reveals a panel on hover, holding The Atelier,
 * Bespoke and Materials. Clicking Atelier itself still navigates to the
 * atelier page. Care is reached from the body of that page, as section 8
 * sets it, rather than from here.
 *
 * Bespoke sits second, between the brand story and the material library: it
 * is the proposition a reader of the atelier page is next in line for, and
 * the materials are the reference they reach for after it.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/collection", label: "Collection" },
  {
    href: "/atelier",
    label: "Atelier",
    children: [
      { href: "/atelier", label: "The Atelier" },
      { href: "/atelier/bespoke", label: "Bespoke" },
      { href: "/atelier/materials", label: "Materials" },
    ],
  },
  { href: "/trade", label: "Trade" },
  { href: "/enquire", label: "Enquire" },
];

/**
 * The four legal documents named in section 05, in the order the footer of
 * every mockup sets them.
 *
 * The cookie policy is deliberately not one of these four. It is reached from
 * the cookie banner instead, because the specification names four legal
 * documents and the mockup footer shows exactly those four.
 */
export const LEGAL_TABS: NavItem[] = [
  { href: "/legal/terms", label: "Terms & Conditions" },
  { href: "/legal/shipping", label: "Shipping & Delivery" },
  { href: "/legal/returns", label: "Returns & Cancellations" },
  { href: "/legal/privacy", label: "Privacy Policy" },
];

/** Maps a legal tab route segment to the page slug held in the database. */
export const LEGAL_SLUGS: Record<string, string> = {
  terms: "legal-terms",
  shipping: "legal-shipping",
  returns: "legal-returns",
  privacy: "legal-privacy",
  cookies: "legal-cookies",
};

/**
 * Secondary pages. Materials moved into the Atelier menu above, where the
 * approved design puts it. Care stays here: it is reached from the body of the
 * atelier page, and the showroom from the enquiry page.
 */
export const SECONDARY_NAV: NavItem[] = [{ href: "/care", label: "Care" }];
