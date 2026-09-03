import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Prose, visibleBody } from "@/components/Prose";
import { getPage } from "@/lib/api";
import { LEGAL_SLUGS } from "@/lib/nav";

interface Props {
  params: Promise<{ tab: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tab } = await params;
  const slug = LEGAL_SLUGS[tab];
  if (!slug) return { title: "Legal" };
  const page = await getPage(slug);
  return { title: page?.title ?? "Legal" };
}

// Section 05 names four legal documents, and the tab row shows those four. The
// cookie policy is a fifth route, reached from the cookie banner rather than
// from the tab row, so it resolves here without appearing in the navigation.
//
// Wording is edited in the admin console. Prerendering would freeze the legal
// text at whatever it said on the day of the build, which on a legal page is
// the wrong default. The route is not enumerated at build time for the same
// reason; an unknown tab is caught below and 404s.
export const dynamic = "force-dynamic";

export default async function LegalTabPage({ params }: Props) {
  const { tab } = await params;
  const slug = LEGAL_SLUGS[tab];
  if (!slug) notFound();

  const page = await getPage(slug);

  return (
    <>
      <h1>{page?.title ?? "Legal"}</h1>
      <div style={{ marginTop: 28 }}>
        {page && visibleBody(page.body) !== "" ? (
          <Prose body={page.body} />
        ) : (
          <p>This page is being prepared.</p>
        )}
      </div>
    </>
  );
}
