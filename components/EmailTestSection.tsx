"use client";

interface Email {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      address: string;
    };
  };
  bodyPreview: string;
  categories?: string[];
}

interface EmailTestSectionProps {
  emails: Email[];
  selectedEmailId: string | null;
  loadingEmails: boolean;
  testing: boolean;
  hasLabels: boolean;
  onLoadEmails: () => void;
  onSelectEmail: (id: string) => void;
  onClassifySelected: () => void;
}

export default function EmailTestSection({
  emails,
  selectedEmailId,
  loadingEmails,
  testing,
  hasLabels,
  onLoadEmails,
  onSelectEmail,
  onClassifySelected,
}: EmailTestSectionProps) {
  return (
    <div className="card">
      <h2>✉️ E-Mails testen</h2>

      <p style={{ color: "#666", marginBottom: "1rem" }}>
        Laden Sie Ihre neuesten E-Mails und testen Sie die Klassifizierung mit
        einem Ihrer Labels.
      </p>

      <button
        onClick={onLoadEmails}
        disabled={loadingEmails}
        className="button"
        style={{ marginBottom: "1rem" }}
      >
        {loadingEmails ? "Lade..." : "📥 Neueste E-Mails laden"}
      </button>

      {emails.length > 0 && (
        <>
          <div
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              border: "1px solid #ddd",
              borderRadius: "8px",
              marginBottom: "1rem",
            }}
          >
            {emails.map((email) => (
              <div
                key={email.id}
                onClick={() => onSelectEmail(email.id)}
                style={{
                  padding: "1rem",
                  borderBottom: "1px solid #eee",
                  cursor: "pointer",
                  backgroundColor:
                    selectedEmailId === email.id ? "#e3f2fd" : "transparent",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (selectedEmailId !== email.id) {
                    e.currentTarget.style.backgroundColor = "#f5f5f5";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedEmailId !== email.id) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                  }}
                >
                  <input
                    type="radio"
                    name="email-selection"
                    checked={selectedEmailId === email.id}
                    onChange={() => onSelectEmail(email.id)}
                    style={{ marginRight: "0.75rem" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: "600",
                        marginBottom: "0.25rem",
                        fontSize: "0.95rem",
                      }}
                    >
                      {email.subject || "(Kein Betreff)"}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#666" }}>
                      Von: {email.from?.emailAddress?.address || "Unbekannt"}
                    </div>
                  </div>
                  {email.categories && email.categories.length > 0 && (
                    <div style={{ marginLeft: "0.5rem" }}>
                      {email.categories.map((cat: string, idx: number) => (
                        <span
                          key={idx}
                          style={{
                            display: "inline-block",
                            padding: "0.2rem 0.5rem",
                            backgroundColor: "#e8f5e9",
                            color: "#2e7d32",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            marginLeft: "0.25rem",
                          }}
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "#888",
                    marginLeft: "1.5rem",
                  }}
                >
                  {email.bodyPreview?.substring(0, 100)}
                  {email.bodyPreview?.length > 100 ? "..." : ""}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onClassifySelected}
            disabled={testing || !selectedEmailId || !hasLabels}
            className="button"
            style={{ marginBottom: "1rem" }}
          >
            {testing
              ? "Klassifiziere..."
              : "✨ Ausgewählte E-Mail klassifizieren"}
          </button>
        </>
      )}

      {!hasLabels && (
        <div className="info">
          <strong>Hinweis:</strong> Erstellen Sie zuerst mindestens einen Label,
          um E-Mails klassifizieren zu können.
        </div>
      )}
    </div>
  );
}
