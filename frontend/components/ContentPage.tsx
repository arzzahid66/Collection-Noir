import { Prose } from "@/components/Prose";
import { getPage } from "@/lib/api";

/**
 * Renders a standing page whose copy lives in the database.
 *
 * Falls back to a quiet placeholder rather than throwing, so a page still
 * renders if the backend is unreachable or the record has not been seeded.
 */
export async function ContentPage({
  slug,
  eyebrow,
  fallbackTitle,
}: {
  slug: string;
  eyebrow: string;
  fallbackTitle: string;
}) {
  const page = await getPage(slug);

  return (
    <section className="page section">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{page?.title ?? fallbackTitle}</h1>
      <div style={{ marginTop: 28 }}>
        {page ? (
          <Prose body={page.body} />
        ) : (
          <p>This page is being prepared.</p>
        )}
      </div>
    </section>
  );
}
