"use client";

// Shared add/edit form for a reading-log entry. Used by LogScreen both as the
// top "add" form and as the inline "edit" form rendered in place of a card.
// Edit mode is derived implicitly from state.editId.

import type { ReactNode } from "react";
import { useApp } from "@/lib/store";
import { copy } from "@/lib/copy";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  color: "var(--color-ink-3)",
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "2px solid var(--color-field-border)",
  fontSize: 15,
  color: "var(--color-ink)",
  outline: "none",
};

export default function EntryForm({ children }: { children?: ReactNode }) {
  const { state, derived, actions } = useApp();
  const isEdit = state.editId !== null;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 20,
        padding: 18,
        boxShadow: "0 10px 28px rgba(80,55,25,.12)",
        animation: "mons-sheet .25s ease both",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 17,
          color: "var(--color-ink)",
          marginBottom: 14,
        }}
      >
        {isEdit ? copy.log.editHeading : copy.log.addHeading}
      </div>

      {/* Quick-pick row (add mode only) is injected by the parent. */}
      {children}

      <label htmlFor="entry-title" style={labelStyle}>
        {copy.log.labels.title}
      </label>
      <input
        id="entry-title"
        value={state.form.title}
        onChange={(e) => actions.setFormField("title", e.target.value)}
        placeholder={copy.log.placeholders.title}
        className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={{ ...inputStyle, marginBottom: 12 }}
      />

      <label htmlFor="entry-author" style={labelStyle}>
        {copy.log.labels.author}
      </label>
      <input
        id="entry-author"
        value={state.form.author}
        onChange={(e) => actions.setFormField("author", e.target.value)}
        placeholder={copy.log.placeholders.author}
        className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={{ ...inputStyle, marginBottom: 12 }}
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="entry-date" style={labelStyle}>
            {copy.log.labels.date}
          </label>
          <input
            id="entry-date"
            type="date"
            value={state.form.date}
            onChange={(e) => actions.setFormField("date", e.target.value)}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="entry-minutes" style={labelStyle}>
            {copy.log.labels.minutes}
          </label>
          <input
            id="entry-minutes"
            type="number"
            min={1}
            inputMode="numeric"
            value={state.form.minutes}
            onChange={(e) => actions.setFormField("minutes", e.target.value)}
            placeholder={copy.log.placeholders.minutes}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={actions.closeForm}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{
            flex: "0 0 auto",
            padding: "13px 18px",
            borderRadius: 13,
            background: "#F4EADb",
            color: "var(--color-ink-2)",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {copy.log.cancel}
        </button>
        <button
          type="button"
          onClick={actions.saveEntry}
          disabled={!derived.valid}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{
            flex: 1,
            padding: 13,
            borderRadius: 13,
            background: "var(--color-accent)",
            color: "#fff",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 16,
            opacity: derived.valid ? 1 : 0.5,
            transition: "opacity .15s ease",
          }}
        >
          {isEdit ? copy.log.saveEdit : copy.log.save}
        </button>
      </div>
    </div>
  );
}
