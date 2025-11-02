"use client";

import { useState, useEffect } from "react";

interface AutoClassifySectionProps {
  userId: string | undefined;
  hasLabels: boolean;
}

export default function AutoClassifySection({
  userId,
  hasLabels,
}: AutoClassifySectionProps) {
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    active: boolean;
    expiry: string | null;
  }>({ active: false, expiry: null });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (userId) {
      checkSubscriptionStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const checkSubscriptionStatus = async () => {
    try {
      const response = await fetch("/api/subscription");
      if (response.ok) {
        const data = await response.json();
        setSubscriptionStatus(data);
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableAutoClassify = async () => {
    if (!hasLabels) {
      setMessage({
        type: "error",
        text: "Bitte erstellen Sie zuerst mindestens einen Label.",
      });
      return;
    }

    setProcessing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/subscription", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to enable auto-classification");
      }

      const data = await response.json();
      setSubscriptionStatus({ active: true, expiry: data.expiry });
      setMessage({
        type: "success",
        text: "Auto-Klassifizierung aktiviert! Neue E-Mails werden automatisch verarbeitet.",
      });
    } catch (error: any) {
      console.error("Error enabling auto-classify:", error);
      setMessage({
        type: "error",
        text: `Fehler: ${error.message}`,
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDisableAutoClassify = async () => {
    setProcessing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/subscription", {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to disable auto-classification");
      }

      setSubscriptionStatus({ active: false, expiry: null });
      setMessage({
        type: "info",
        text: "Auto-Klassifizierung deaktiviert.",
      });
    } catch (error: any) {
      console.error("Error disabling auto-classify:", error);
      setMessage({
        type: "error",
        text: `Fehler: ${error.message}`,
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <h2>🤖 Automatische Klassifizierung</h2>
        <p>Lädt...</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>🤖 Automatische Klassifizierung</h2>

      <p style={{ color: "#666", marginBottom: "1rem" }}>
        Aktivieren Sie die automatische Klassifizierung, damit neue E-Mails
        sofort verarbeitet werden, sobald sie in Ihrem Posteingang eintreffen.
      </p>

      {message && (
        <div
          className={
            message.type === "success"
              ? "success"
              : message.type === "error"
              ? "error"
              : "info"
          }
          style={{ marginBottom: "1rem" }}
        >
          {message.text}
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <strong>Status:</strong>{" "}
        {subscriptionStatus.active ? (
          <span style={{ color: "#2e7d32" }}>✓ Aktiv</span>
        ) : (
          <span style={{ color: "#d32f2f" }}>✗ Inaktiv</span>
        )}
      </div>

      {subscriptionStatus.active && subscriptionStatus.expiry && (
        <div
          style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "#666" }}
        >
          Läuft ab:{" "}
          {new Date(subscriptionStatus.expiry).toLocaleString("de-DE")}
        </div>
      )}

      {!subscriptionStatus.active ? (
        <button
          onClick={handleEnableAutoClassify}
          disabled={processing || !hasLabels}
          className="button"
          style={{ marginBottom: "1rem" }}
        >
          {processing ? "Aktiviere..." : "🚀 Auto-Klassifizierung aktivieren"}
        </button>
      ) : (
        <button
          onClick={handleDisableAutoClassify}
          disabled={processing}
          className="button button-secondary"
          style={{ marginBottom: "1rem" }}
        >
          {processing
            ? "Deaktiviere..."
            : "⏸️ Auto-Klassifizierung deaktivieren"}
        </button>
      )}

      {!hasLabels && (
        <div className="info">
          <strong>Hinweis:</strong> Erstellen Sie zuerst mindestens einen Label,
          um die automatische Klassifizierung nutzen zu können.
        </div>
      )}

      <div className="info">
        <strong>Wie es funktioniert:</strong>
        <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li>
            Sobald eine neue E-Mail in Ihrem Posteingang eintrifft, wird sie
            automatisch analysiert
          </li>
          <li>Die KI wählt den passenden Label basierend auf dem Inhalt</li>
          <li>
            Falls ein Draft-Prompt definiert ist, wird automatisch ein
            Antwortentwurf erstellt
          </li>
          <li>
            Die Klassifizierung erfolgt innerhalb weniger Sekunden nach
            E-Mail-Eingang
          </li>
          <li>
            ✨ <strong>Automatische Verlängerung:</strong> Das Abonnement wird
            alle 12 Stunden automatisch geprüft und bei Bedarf verlängert
          </li>
        </ul>
      </div>
    </div>
  );
}
