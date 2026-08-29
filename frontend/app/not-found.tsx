import Link from "next/link";

export default function NotFound() {
  return (
    <section className="page section">
      <p className="eyebrow">Not found</p>
      <h1>That page is not here</h1>
      <p style={{ marginTop: 18 }}>
        The page may have moved, or the piece may not be in the current
        collection.
      </p>
      <p style={{ marginTop: 24 }}>
        <Link href="/collection" className="quiet-link">
          Return to the collection
        </Link>
      </p>
    </section>
  );
}
