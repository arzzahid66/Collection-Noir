/**
 * Studio and contact details, sections 3 and 11.1.
 *
 * Held in one place because the address, the tagline and the Instagram link
 * are required in the footer of every page, and the enquiry page repeats the
 * address and the contact details alongside the form.
 */
export const STUDIO = {
  name: "Collection Noir",
  tagline: "London Design. Italian Craft.",

  /*
   * Broken across the two lines the specification sets it on, and with an en
   * dash in the street number rather than a hyphen: section 3 calls that out
   * by name, because a hyphen in a number range is a typographic error the
   * eye passes straight over.
   *
   * The footer and the enquiry page set the address differently. Section 3
   * ends the second line at the postcode; section 11.1 includes London
   * before it, because that block is read by someone deciding whether to
   * visit. So there are two, and neither is a copy of the other with a word
   * removed at render time.
   */
  addressLines: ["132–134 Lots Road, Worlds End Studios", "Unit 124, SW10 0RJ"],
  showroomLines: [
    "132–134 Lots Road, Worlds End Studios",
    "Unit 124, London SW10 0RJ",
  ],
  addressOneLine:
    "Worlds End Studios, 132–134 Lots Road, Unit 124, London SW10 0RJ",

  email: "info@collectionnoir.com",

  /* As set in the approved design. An earlier reading of figure 11 gave the
   * last four digits as 7051; the approved design reads 7295. */
  telephone: "020 7349 7295",
  telephoneHref: "tel:+442073497295",

  /* TODO(client): confirm the account handle. The specification requires an
   * Instagram link in the footer of every page but does not give the URL. */
  instagram: "https://www.instagram.com/collectionnoir/",

  /* Viewing is by appointment, per the enquiry mockup. */
  showroomNote: "Appointment Only",
} as const;
