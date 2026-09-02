import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";

import { CookieBanner } from "@/components/CookieBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "@/styles/globals.css";

/**
 * The only typeface on this site. There is no secondary font: body copy,
 * micro labels, prices and form fields are all Cormorant Garamond, and the
 * fallback is Georgia rather than a sans, so a failed load still reads as a
 * serif rather than as system Arial.
 *
 * Weights 300, 400 and 600 with italics at 300 and 400, per section 1.1 of
 * the correction brief. 300 carries almost everything; the heavier cuts are
 * loaded because the brief specifies them.
 *
 * next/font downloads the files at build time and serves them from this
 * origin, so no request reaches Google at runtime. That is the self hosted
 * position the Cookie Policy prefers, and it means the font adds no third
 * party to disclose.
 */
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://collectionnoir.com"),
  title: {
    default: "Collection Noir",
    template: "%s · Collection Noir",
  },
  description:
    "London Design. Italian Craft. An atelier working in marble, solid timber and hand worked metal. Every piece made to order.",
  openGraph: {
    siteName: "Collection Noir",
    locale: "en_GB",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * suppressHydrationWarning on these two elements only.
     *
     * Browser extensions commonly write attributes onto <html> and <body>
     * before React hydrates, which React then reports as a mismatch against
     * markup it never produced. The flag applies one level deep, to the
     * attributes and text of the element carrying it, so a genuine mismatch
     * anywhere inside the application is still reported normally.
     */
    <html lang="en-GB" className={cormorant.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <CookieBanner />
      </body>
    </html>
  );
}
