"use client";

// Læselog (Reading log) screen. Lists reading entries newest-first, hosts the
// add form (with quick-pick chips) and inline edit/delete affordances.
// Returns only the screen's inner scroll content — the frame, header and bottom
// nav come from <AppShell/>.

import { useApp } from "@/lib/store";
import { copy } from "@/lib/copy";
import EntryForm from "@/components/EntryForm";
import QuickPickRow from "@/components/QuickPickRow";

export default function LogScreen() {
  const { state, derived, actions } = useApp();
  const showAddForm = state.formOpen && state.editId === null;

  return (
    <section
      aria-label={copy.log.title}
      style={{ flex: "1 1 auto", overflowY: "auto", padding: "6px 22px 24px" }}
    >
      {/* Header: title + total summary */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 20,
            color: "var(--color-ink)",
          }}
        >
          {copy.log.title}
        </h2>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-ink-3)" }}>
          {derived.total} {copy.log.totalSuffix}
        </div>
      </div>

      {/* Add button (only when no form is open) */}
      {!state.formOpen && (
        <button
          type="button"
          onClick={actions.openAdd}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 16,
            background: "var(--color-accent)",
            color: "#fff",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 8px 18px rgba(246,166,35,.32)",
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1, marginTop: -2 }}>+</span>{" "}
          {copy.log.addBtn}
        </button>
      )}

      {/* Top add form with quick-pick chips above the Titel field */}
      {showAddForm && (
        <EntryForm>{derived.hasRecentBooks && <QuickPickRow />}</EntryForm>
      )}

      {/* Empty state */}
      {derived.noEntries && (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "#BBA98F" }}>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>
            {copy.log.emptyLine1}
            <br />
            {copy.log.emptyLine2Prefix}
            <b style={{ color: "var(--color-ink-2)" }}>{copy.log.emptyLine2Bold}</b>
            {copy.log.emptyLine2Suffix}
          </div>
        </div>
      )}

      {/* Entry list */}
      <div
        style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 11 }}
      >
        {derived.viewEntries.map((item) =>
          item.editing ? (
            <EntryForm key={item.entry.id} />
          ) : (
            <div
              key={item.entry.id}
              style={{
                background: item.flashing ? "var(--color-flash)" : "#fff",
                borderRadius: 18,
                padding: "15px 16px",
                boxShadow: "0 6px 16px rgba(80,55,25,.08)",
                transition: "background .5s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 16,
                      color: "var(--color-ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.entry.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--color-ink-3)",
                      marginTop: 2,
                    }}
                  >
                    {item.byline} · {item.dateLabel}
                  </div>
                </div>
                <div
                  style={{
                    flex: "0 0 auto",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 11px",
                    borderRadius: 999,
                    background: "#FBEFDB",
                    color: "#C98A2B",
                    fontWeight: 800,
                    fontSize: 14,
                  }}
                >
                  {item.entry.minutes} {copy.log.minutesSuffix}
                </div>
              </div>

              {item.confirming ? (
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "#FCEDEA",
                    borderRadius: 12,
                    padding: "10px 12px",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#C0584A",
                    }}
                  >
                    {copy.log.deleteConfirm}
                  </span>
                  <button
                    type="button"
                    onClick={() => actions.deleteEntry(item.entry.id)}
                    className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    style={{
                      padding: "7px 14px",
                      borderRadius: 9,
                      background: "#E06A57",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {copy.log.delete}
                  </button>
                  <button
                    type="button"
                    onClick={actions.cancelDelete}
                    className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    style={{
                      padding: "7px 12px",
                      borderRadius: 9,
                      color: "var(--color-ink-3)",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {copy.log.keep}
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderTop: "1.5px solid #F4EADb",
                    paddingTop: 11,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => actions.openEdit(item.entry)}
                    className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--color-ink-2)",
                      padding: "4px 8px",
                    }}
                  >
                    {copy.log.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => actions.askDelete(item.entry.id)}
                    className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#C98074",
                      padding: "4px 8px",
                    }}
                  >
                    {copy.log.delete}
                  </button>
                  {item.flashing && (
                    <div
                      style={{
                        marginLeft: "auto",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        color: "var(--color-badge)",
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" fill="#5C8A3F" />
                        <path
                          d="M7.5 12.5 L10.5 15.5 L16.5 9"
                          stroke="#fff"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {copy.log.flashEdited}
                    </div>
                  )}
                </div>
              )}
            </div>
          ),
        )}
      </div>
    </section>
  );
}
