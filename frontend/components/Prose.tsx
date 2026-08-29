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

/**
 * `measure` names the cap to apply, and there is no default.
 *
 * Section 13 is explicit that body copy runs the full width of its column
 * and that a centred max-width container is wrong. Six blocks are capped,
 * each named individually by the specification; every other block on the
 * site passes nothing here and runs full width.
 */
export function Prose({ body, measure }: { body: string; measure?: string }) {
  const blocks = body.trim().split(/\n\s*\n/);

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
