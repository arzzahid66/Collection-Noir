import type { Metadata } from "next";

import { ContentPage } from "@/components/ContentPage";

export const metadata: Metadata = { title: "Bespoke" };

// Copy is editable in the admin console, so this page is never baked in at
// build time. An edit is visible on the next request.
export const dynamic = "force-dynamic";

/**
 * Bespoke, a page under the Atelier.
 *
 * Added at the client's request alongside The Atelier and Materials. The
 * commission proposition already appears in short on the homepage, as
 * `home-bespoke`; this is the page that sets it out at length, and it holds
 * its own record so the two can be written differently.
 *
 * The copy is the client's to write. Until they do, the seeded body carries a
 * TODO(client) marker, which is what the admin console reads to list a page
 * as outstanding.
 */
export default function Page() {
  return (
    <ContentPage
      slug="atelier-bespoke"
      eyebrow="The Atelier"
      fallbackTitle="Bespoke"
    />
  );
}
