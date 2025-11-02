"use client";

import { useState } from "react";
import { Label } from "@/types/label";
import { OUTLOOK_COLORS } from "@/constants/outlookColors";

interface LabelFormProps {
  label: Label | null;
  onSave: (data: Partial<Label>) => void;
  onCancel: () => void;
  saving: boolean;
}

export default function LabelForm({
  label,
  onSave,
  onCancel,
  saving,
}: LabelFormProps) {
  const [name, setName] = useState(label?.name || "");
  const [description, setDescription] = useState(label?.description || "");
  const [draftPrompt, setDraftPrompt] = useState(label?.draft_prompt || "");
  const [color, setColor] = useState(label?.color || "preset0");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || !draftPrompt.trim()) {
      alert("Bitte füllen Sie alle Felder aus.");
      return;
    }
    onSave({ name, description, draft_prompt: draftPrompt, color });
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        className="card"
        style={{
          maxWidth: "600px",
          width: "90%",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{label ? "Label bearbeiten" : "Neuer Label"}</h2>

        <form onSubmit={handleSubmit}>
          <label className="label">Label-Name:</label>
          <input
            type="text"
            className="textarea"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Needs Reply, Waiting, FYI"
            style={{ marginBottom: "1rem" }}
          />

          <label className="label">Beschreibung (für Klassifizierung):</label>
          <textarea
            className="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beschreiben Sie, wann eine E-Mail diesen Label erhalten soll..."
            rows={3}
            style={{ marginBottom: "1rem" }}
          />

          <label className="label">Draft-Prompt (für Antworterstellung):</label>
          <textarea
            className="textarea"
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            placeholder="Geben Sie an, wie der Antwortentwurf für diesen Label aussehen soll..."
            rows={5}
            style={{ marginBottom: "1rem" }}
          />

          <label className="label">Farbe (Outlook):</label>
          <select
            className="textarea"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ marginBottom: "1rem" }}
          >
            {OUTLOOK_COLORS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.name}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" disabled={saving} className="button">
              {saving ? "Speichern..." : "Speichern"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="button button-secondary"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
