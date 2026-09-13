import type { ReactNode } from "react";

/**
 * Minimal markdown renderer for page copy held in the database.
 *
 * Deliberately small: headings, paragraphs, lists and inline emphasis are all
 * the standing pages use. Content is parsed into React elements rather than
 * injected as HTML, so a page body can never introduce markup.
 *
 * Source bodies are hard wrapped, so lines within a block are joined with a
 * space before rendering.
 */

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Split on **emphasis** and on TODO(client) placeholders.
  const pattern = /(\*\*[^*]+\*\*|TODO\(client\)[^.\n]*\.?)/g;
  const parts = text.split(pattern).filter((part) => part !== "");

  parts.forEach((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      // Rendered as emphasis without weight. The site carries one typeface
      // at one weight, so the mark is an italic cut rather than bold. On the
      // legal pages this is what draws the eye to the cancellation position,
      // which has to be brought to a client's attention.
      nodes.push(<em key={key}>{part.slice(2, -2)}</em>);
    } else if (part.startsWith("TODO(client)")) {
      // Not reached through `Prose`, which drops a marked block before it
      // gets here. Kept so any future caller rendering a line directly still
      // marks a placeholder as one rather than setting it as finished copy.
      nodes.push(
        <span className="todo" key={key} data-todo="true">
          {part}
        </span>,
      );
    } else {
      nodes.push(part);
    }
  });

  return nodes;
}

const TODO_MARKER = "TODO(client)";

/**
 * The copy that may be shown to a visitor.
 *
 * Page bodies carry TODO(client) markers where a fact is still outstanding:
 * a company number, a deposit percentage, a transit window. The console
 * shows them, and should, because they are the list of what the business
 * still owes the site. The public site must not: they are notes to the brand
 * team, and a legal page that publishes its own unanswered questions is
 * worse than one that says it is being prepared.
 *
 * The whole block goes, not the marked sentence. Half of these markers
 * finish a sentence rather than stand alone, so cutting the sentence and
 * keeping the block leaves "Registered company number:" with nothing after
 * it. Dropping the block loses the finished copy that shares a paragraph
 * with an unfinished fact, which is the right trade: that paragraph is
 * incomplete either way.
 */
export function visibleBody(body: string): string {
  return body
    .trim()
    .split(/\n\s*\n/)
    .filter((block) => !block.includes(TODO_MARKER))
    .join("\n\n")
    .trim();
}

/**
 * `measure` names the cap to apply, and there is no default.
 *
 * Section 13 is explicit that body copy runs the full width of its column
 * and that a centred max-width container is wrong. Six blocks are capped,
 * each named individually by the specification; every other block on the
 * site passes nothing here and runs full width.
 */
export function Prose({ body, measure }: { body: string; measure?: string }) {
  const visible = visibleBody(body);

  /* Every block was a placeholder. The callers that own a fallback line
     say the page is being prepared; the rest keep their own heading and
     simply have nothing to set under it. */
  if (!visible) return null;

  const blocks = visible.split(/\n\s*\n/);

  return (
    <div className={measure ? `prose ${measure}` : "prose"}>
      {blocks.map((rawBlock, blockIndex) => {
        const block = rawBlock.trim();
        const key = `block-${blockIndex}`;

        if (block.startsWith("### ")) {
          return <h3 key={key}>{inline(block.slice(4).replace(/\n\s*/g, " "), key)}</h3>;
        }
        if (block.startsWith("## ")) {
          return <h2 key={key}>{inline(block.slice(3).replace(/\n\s*/g, " "), key)}</h2>;
        }

        const lines = block.split("\n").map((line) => line.trim());
        if (lines.every((line) => line.startsWith("- "))) {
          return (
            <ul key={key}>
              {lines.map((line, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{inline(line.slice(2), `${key}-${itemIndex}`)}</li>
              ))}
            </ul>
          );
        }

        return <p key={key}>{inline(lines.join(" "), key)}</p>;
      })}
    </div>
  );
}
