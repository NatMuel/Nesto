"use client";

import { Label } from "@/types/label";
import { getColorPreview } from "@/constants/outlookColors";

interface LabelCardProps {
  label: Label;
  onEdit: () => void;
  onDelete: () => void;
}

export default function LabelCard({ label, onEdit, onDelete }: LabelCardProps) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "1rem",
        marginBottom: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "0.5rem",
        }}
      >
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: "0 0 0.5rem 0" }}>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                marginRight: "0.5rem",
                backgroundColor: getColorPreview(label.color),
              }}
            />
            {label.name}
          </h3>
          <p style={{ margin: "0 0 0.5rem 0", color: "#666" }}>
            <strong>Beschreibung:</strong> {label.description}
          </p>
          <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
            <strong>Draft-Prompt:</strong>{" "}
            {label.draft_prompt.substring(0, 100)}
            {label.draft_prompt.length > 100 ? "..." : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={onEdit}
            className="button button-secondary"
            style={{ padding: "0.4rem 0.8rem", fontSize: "0.9rem" }}
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            className="button button-secondary"
            style={{
              padding: "0.4rem 0.8rem",
              fontSize: "0.9rem",
              backgroundColor: "#fee",
              color: "#c00",
            }}
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}
