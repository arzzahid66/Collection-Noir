import type { Metadata } from "next";

import { ContentPage } from "@/components/ContentPage";

export const metadata: Metadata = { title: "Frequently asked questions" };

// Copy is editable in the admin console, so this page is never baked in at
// build time. An edit is visible on the next request.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <ContentPage
      slug="faqs"
      eyebrow="Enquiries"
      fallbackTitle="Frequently asked questions"
    />
  );
}
