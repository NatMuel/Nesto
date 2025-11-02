"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Label {
  id: string;
  name: string;
  description: string;
  draft_prompt: string;
  color: string;
  display_order: number;
}

const OUTLOOK_COLORS = [
  { name: "Red", value: "preset0" },
  { name: "Orange", value: "preset1" },
  { name: "Brown", value: "preset2" },
  { name: "Yellow", value: "preset3" },
  { name: "Green", value: "preset4" },
  { name: "Teal", value: "preset5" },
  { name: "Olive", value: "preset6" },
  { name: "Blue", value: "preset7" },
  { name: "Purple", value: "preset8" },
  { name: "Cranberry", value: "preset9" },
  { name: "Steel", value: "preset10" },
  { name: "DarkSteel", value: "preset11" },
  { name: "Gray", value: "preset12" },
  { name: "DarkGray", value: "preset13" },
  { name: "Black", value: "preset14" },
  { name: "DarkRed", value: "preset15" },
  { name: "DarkOrange", value: "preset16" },
  { name: "DarkBrown", value: "preset17" },
  { name: "DarkYellow", value: "preset18" },
  { name: "DarkGreen", value: "preset19" },
  { name: "DarkTeal", value: "preset20" },
  { name: "DarkOlive", value: "preset21" },
  { name: "DarkBlue", value: "preset22" },
  { name: "DarkPurple", value: "preset23" },
  { name: "DarkCranberry", value: "preset24" },
];

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [generalPrompt, setGeneralPrompt] = useState("");
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [showLabelForm, setShowLabelForm] = useState(false);
  const [latestEmails, setLatestEmails] = useState<any[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    loadUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserData = async () => {
    const defaultPrompt =
      "Du bist Assistenz einer Hausverwaltung. Analysiere eingehende E-Mails basierend auf den verfügbaren Kategorien und erstelle professionelle Antwortentwürfe auf Deutsch im 'Sie'-Ton.";

    try {
      // Get the current user
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        console.error("Auth error:", error);
        router.push("/");
        return;
      }

      // Get user settings from Supabase
      const { data: settingsData, error: settingsError } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (settingsError && settingsError.code !== "PGRST116") {
        console.error("Error loading settings:", settingsError);
      }

      // Check if this is first time (no settings row exists)
      const isNew = settingsError?.code === "PGRST116" || !settingsData;
      setIsFirstTime(isNew);

      setUser(user);
      setGeneralPrompt(settingsData?.general_prompt || "");

      // Load labels
      const { data: labelsData, error: labelsError } = await supabase
        .from("labels")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order", { ascending: true });

      if (labelsError) {
        console.error("Error loading labels:", labelsError);
      } else {
        setLabels(labelsData || []);
      }

      // Store Microsoft tokens from session if not already stored
      const { data: sessionData } = await supabase.auth.getSession();
      const providerToken = sessionData.session?.provider_token;
      const providerRefreshToken = sessionData.session?.provider_refresh_token;

      if (providerToken && !settingsData?.microsoft_access_token) {
        // Calculate token expiry (usually 1 hour from now)
        const tokenExpiry = new Date(Date.now() + 3600 * 1000).toISOString();

        // First ensure a settings row exists
        if (isNew) {
          await supabase.from("user_settings").insert({
            user_id: user.id,
            general_prompt: defaultPrompt,
            microsoft_access_token: providerToken,
            microsoft_refresh_token: providerRefreshToken,
            microsoft_token_expiry: tokenExpiry,
          });
        } else {
          // Update existing row
          await supabase
            .from("user_settings")
            .update({
              microsoft_access_token: providerToken,
              microsoft_refresh_token: providerRefreshToken,
              microsoft_token_expiry: tokenExpiry,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id);
        }

        console.log("Microsoft tokens stored successfully");
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeneralPrompt = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not authenticated");
      }

      // Use default prompt if empty
      const defaultPrompt =
        "Du bist Assistenz einer Hausverwaltung. Analysiere eingehende E-Mails basierend auf den verfügbaren Kategorien und erstelle professionelle Antwortentwürfe auf Deutsch im 'Sie'-Ton.";
      const promptToSave = generalPrompt.trim() || defaultPrompt;

      // Update the settings
      const { error: updateError } = await supabase
        .from("user_settings")
        .update({
          general_prompt: promptToSave,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }

      setIsFirstTime(false);
      setGeneralPrompt(promptToSave);
      setMessage({
        type: "success",
        text: "Allgemeiner Prompt erfolgreich gespeichert!",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({ type: "error", text: "Fehler beim Speichern" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLabel = async (labelData: Partial<Label>) => {
    setSaving(true);
    setMessage(null);

    try {
      if (editingLabel) {
        // Update existing label
        const response = await fetch("/api/labels", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingLabel.id, ...labelData }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update label");
        }

        const { label } = await response.json();
        setLabels((prev) => prev.map((l) => (l.id === label.id ? label : l)));
        setMessage({ type: "success", text: "Label aktualisiert!" });
      } else {
        // Create new label
        const response = await fetch("/api/labels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(labelData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create label");
        }

        const { label } = await response.json();
        setLabels((prev) => [...prev, label]);
        setMessage({ type: "success", text: "Label erstellt!" });
      }

      setShowLabelForm(false);
      setEditingLabel(null);
    } catch (error: any) {
      console.error("Error saving label:", error);
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    if (!confirm("Möchten Sie diesen Label wirklich löschen?")) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/labels?id=${labelId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete label");
      }

      setLabels((prev) => prev.filter((l) => l.id !== labelId));
      setMessage({ type: "success", text: "Label gelöscht!" });
    } catch (error: any) {
      console.error("Error deleting label:", error);
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleLoadEmails = async () => {
    setLoadingEmails(true);
    setMessage(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.provider_token;

      if (!accessToken) {
        throw new Error(
          "Kein Microsoft-Zugriffstoken gefunden. Bitte melden Sie sich ab und wieder an."
        );
      }

      // Call Microsoft Graph API to get latest emails
      const response = await fetch(
        "https://graph.microsoft.com/v1.0/me/messages?$top=10&$select=id,subject,from,receivedDateTime,bodyPreview,categories",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error?.message || "Fehler beim Laden der E-Mails"
        );
      }

      const data = await response.json();
      setLatestEmails(data.value || []);

      if (data.value && data.value.length > 0) {
        setMessage({
          type: "success",
          text: `${data.value.length} E-Mails geladen!`,
        });
      } else {
        setMessage({
          type: "error",
          text: "Keine E-Mails gefunden.",
        });
      }
    } catch (error: any) {
      console.error("Load emails error:", error);
      setMessage({
        type: "error",
        text: `Fehler: ${error.message}`,
      });
    } finally {
      setLoadingEmails(false);
    }
  };

  const handleClassifySelected = async () => {
    if (!selectedEmailId) {
      setMessage({
        type: "error",
        text: "Bitte wählen Sie zuerst eine E-Mail aus.",
      });
      return;
    }

    setTesting(true);
    setMessage(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.provider_token;

      if (!accessToken) {
        throw new Error("Kein Microsoft-Zugriffstoken gefunden.");
      }

      if (labels.length === 0) {
        throw new Error("Bitte erstellen Sie zuerst mindestens einen Label.");
      }

      // Get the selected email with full body
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${selectedEmailId}?$select=id,subject,from,body,bodyPreview,categories`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Fehler beim Abrufen der E-Mail");
      }

      const email = await response.json();

      // Call classification API with access token
      const classifyResponse = await fetch("/api/classify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messageId: email.id,
          subject: email.subject,
          body: email.body?.content || email.bodyPreview,
          from: email.from?.emailAddress?.address,
        }),
      });

      if (!classifyResponse.ok) {
        const error = await classifyResponse.json();
        throw new Error(error.error || "Klassifizierung fehlgeschlagen");
      }

      const result = await classifyResponse.json();

      setMessage({
        type: "success",
        text: `E-Mail klassifiziert als "${result.label}"! ${
          result.draftCreated ? "Antwortentwurf erstellt." : ""
        }`,
      });

      // Reload emails to show updated categories
      await handleLoadEmails();
    } catch (error: any) {
      console.error("Classify error:", error);
      setMessage({
        type: "error",
        text: `Fehler: ${error.message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="container">
        <div
          className="card"
          style={{ textAlign: "center", marginTop: "4rem" }}
        >
          <p>Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header" style={{ marginTop: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/">
            <Image
              src="/nesto-logo.png"
              alt="Nesto Logo"
              width={120}
              height={60}
              style={{ cursor: "pointer", objectFit: "contain" }}
            />
          </Link>
          <div>
            <h1 style={{ margin: 0 }}>⚙️ Einstellungen</h1>
            {user && (
              <p style={{ color: "#666", margin: "0.5rem 0 0 0" }}>
                Angemeldet als: <strong>{user.email}</strong>
              </p>
            )}
          </div>
        </div>
        <button onClick={handleLogout} className="button button-secondary">
          Abmelden
        </button>
      </div>

      {message && (
        <div
          className={message.type === "success" ? "success" : "error"}
          style={{ marginBottom: "1rem" }}
        >
          {message.text}
        </div>
      )}

      <div className="card">
        <h2>🌐 Allgemeiner Prompt</h2>
        <p style={{ color: "#666", marginBottom: "1rem" }}>
          Dieser allgemeine Prompt definiert den Kontext und Ton für die gesamte
          E-Mail-Verarbeitung. Er wird sowohl bei der Klassifizierung als auch
          bei der Antworterstellung verwendet.
        </p>

        {isFirstTime && (
          <div className="info" style={{ marginBottom: "1rem" }}>
            <strong>Erste Einrichtung:</strong> Passen Sie den allgemeinen
            Prompt an und erstellen Sie dann Ihre Labels unten.
          </div>
        )}

        <label className="label">Allgemeiner Prompt:</label>
        <textarea
          className="textarea"
          value={generalPrompt}
          onChange={(e) => setGeneralPrompt(e.target.value)}
          placeholder="Du bist Assistenz einer Hausverwaltung. Analysiere eingehende E-Mails basierend auf den verfügbaren Kategorien und erstelle professionelle Antwortentwürfe auf Deutsch im 'Sie'-Ton."
          rows={6}
        />

        <button
          onClick={handleSaveGeneralPrompt}
          disabled={saving}
          className="button"
        >
          {saving ? "Speichern..." : "Allgemeinen Prompt speichern"}
        </button>
      </div>

      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ margin: 0 }}>🏷️ Labels</h2>
          <button
            onClick={() => {
              setEditingLabel(null);
              setShowLabelForm(true);
            }}
            className="button"
          >
            + Neues Label
          </button>
        </div>

        <p style={{ color: "#666", marginBottom: "1.5rem" }}>
          Labels definieren, wie E-Mails klassifiziert werden. Jedes Label hat
          eine Beschreibung für die Klassifizierung und einen Draft-Prompt für
          die Antworterstellung.
        </p>

        {labels.length === 0 && (
          <div className="info">
            <strong>Keine Labels vorhanden.</strong> Erstellen Sie Ihren ersten
            Label, um mit der E-Mail-Klassifizierung zu beginnen.
          </div>
        )}

        {labels.map((label) => (
          <div
            key={label.id}
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
                  onClick={() => {
                    setEditingLabel(label);
                    setShowLabelForm(true);
                  }}
                  className="button button-secondary"
                  style={{ padding: "0.4rem 0.8rem", fontSize: "0.9rem" }}
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDeleteLabel(label.id)}
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
        ))}
      </div>

      {showLabelForm && (
        <LabelForm
          label={editingLabel}
          onSave={handleSaveLabel}
          onCancel={() => {
            setShowLabelForm(false);
            setEditingLabel(null);
          }}
          saving={saving}
        />
      )}

      <div className="card">
        <h2>✉️ E-Mails testen</h2>

        <p style={{ color: "#666", marginBottom: "1rem" }}>
          Laden Sie Ihre neuesten E-Mails und testen Sie die Klassifizierung mit
          einem Ihrer Labels.
        </p>

        <button
          onClick={handleLoadEmails}
          disabled={loadingEmails}
          className="button"
          style={{ marginBottom: "1rem" }}
        >
          {loadingEmails ? "Lade..." : "📥 Neueste E-Mails laden"}
        </button>

        {latestEmails.length > 0 && (
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
              {latestEmails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmailId(email.id)}
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
                      onChange={() => setSelectedEmailId(email.id)}
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
              onClick={handleClassifySelected}
              disabled={testing || !selectedEmailId || labels.length === 0}
              className="button"
              style={{ marginBottom: "1rem" }}
            >
              {testing
                ? "Klassifiziere..."
                : "✨ Ausgewählte E-Mail klassifizieren"}
            </button>
          </>
        )}

        {labels.length === 0 && (
          <div className="info">
            <strong>Hinweis:</strong> Erstellen Sie zuerst mindestens einen
            Label, um E-Mails klassifizieren zu können.
          </div>
        )}
      </div>
    </div>
  );
}

function LabelForm({
  label,
  onSave,
  onCancel,
  saving,
}: {
  label: Label | null;
  onSave: (data: Partial<Label>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
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

function getColorPreview(presetValue: string): string {
  const colorMap: Record<string, string> = {
    preset0: "#e74c3c",
    preset1: "#e67e22",
    preset2: "#8b4513",
    preset3: "#f39c12",
    preset4: "#27ae60",
    preset5: "#16a085",
    preset6: "#808000",
    preset7: "#3498db",
    preset8: "#9b59b6",
    preset9: "#c0392b",
    preset10: "#95a5a6",
    preset11: "#34495e",
    preset12: "#7f8c8d",
    preset13: "#2c3e50",
    preset14: "#000000",
    preset15: "#c0392b",
    preset16: "#d35400",
    preset17: "#6e3b1e",
    preset18: "#f1c40f",
    preset19: "#1e8449",
    preset20: "#117a65",
    preset21: "#6b6b00",
    preset22: "#2874a6",
    preset23: "#7d3c98",
    preset24: "#922b21",
  };
  return colorMap[presetValue] || "#3498db";
}
