"use client";

// Horizontal "continue a book?" chip row shown above the Titel field in the
// add form. Chips bleed to the card edges via negative side margins, matching
// the prototype. Highlighted chips (already filled into the form) get an amber
// fill + accent border.

import { useApp } from "@/lib/store";
import { copy } from "@/lib/copy";

const ellipsis: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: 152,
};

export default function QuickPickRow() {
  const { derived, actions } = useApp();

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--color-ink-3)",
          marginBottom: 8,
        }}
      >
        {copy.log.quickPickPrompt}
      </div>
      <div
        style={{
          display: "flex",
          gap: 9,
          overflowX: "auto",
          paddingBottom: 4,
          margin: "0 -18px",
          paddingLeft: 18,
          paddingRight: 18,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {derived.recentBooks.map((book, i) => (
          <button
            key={`${book.title}|${book.author}|${i}`}
            type="button"
            onClick={() => actions.pickRecent(book.title, book.author)}
            aria-label={`${book.title} ${book.byline}`}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{
              flex: "0 0 auto",
              maxWidth: 180,
              textAlign: "left",
              padding: "10px 14px",
              borderRadius: 14,
              border: `2px solid ${book.highlighted ? "var(--color-accent)" : "var(--color-field-border)"}`,
              background: book.highlighted ? "#FBEFDB" : "#fff",
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 14,
                color: "var(--color-ink)",
                ...ellipsis,
              }}
            >
              {book.title}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-ink-3)",
                ...ellipsis,
              }}
            >
              {book.byline}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
