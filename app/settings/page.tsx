"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Label } from "@/types/label";
import LabelForm from "@/components/LabelForm";
import LabelCard from "@/components/LabelCard";
import EmailTestSection from "@/components/EmailTestSection";
import AutoClassifySection from "@/components/AutoClassifySection";

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
    const defaultPrompt = `Du bist Daniel Klat, Mitarbeiter der Hausverwalter IMPERIAL Residential GmbH.

Deine Rolle:
- Analysiere eingehende E-Mails professionell und präzise
- Formuliere höfliche Antwortentwürfe im "Sie"-Ton auf Deutsch
- Prüfe bei Anfragen immer die rechtliche Situation
- Vertritt primär die Interessen des Eigentümers, bleibe aber fair

Wichtige Grundsätze:
- Mietminderungen grundsätzlich in erster Instanz ablehnen
- Bei Rechtsfällen auf Fristen und rechtliche Konsequenzen hinweisen
- Bei fehlenden Informationen nachfragen
- Professionell, sachlich und lösungsorientiert kommunizieren

Füge dieses Impressum JEDER E-Mail hinzu:

Daniel Klat
IMPERIAL Base GmbH

Tel.: 030 754362156
E-Mail: office@imperial-berlin.de

Registergericht: Amtsgericht Charlottenburg (Berlin)
Registernummer: HRB 276447 B

Geschäftsführer: Wladimir Klat, Dr. Kolja Köhler

Umsatzsteuer-Identifikationsnummer: DE 151998119

Genehmigung nach § 34c GewO

Sitz der GmbH:
Gabriel-Max-Str. 12
10245 Berlin`;

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        console.error("Auth error:", error);
        router.push("/");
        return;
      }

      const { data: settingsData, error: settingsError } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (settingsError && settingsError.code !== "PGRST116") {
        console.error("Error loading settings:", settingsError);
      }

      const isNew = settingsError?.code === "PGRST116" || !settingsData;
      setIsFirstTime(isNew);
      setUser(user);
      setGeneralPrompt(settingsData?.general_prompt || "");

      const { data: labelsData, error: labelsError } = await supabase
        .from("labels")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order", { ascending: true });

      if (labelsError) {
        console.error("Error loading labels:", labelsError);
      } else {
        // If user has no labels, initialize default labels
        if (!labelsData || labelsData.length === 0) {
          try {
            const initResponse = await fetch("/api/init-defaults", {
              method: "POST",
            });

            if (initResponse.ok) {
              const initData = await initResponse.json();
              console.log("Default labels initialized:", initData);

              // Reload labels after initialization
              const { data: newLabelsData } = await supabase
                .from("labels")
                .select("*")
                .eq("user_id", user.id)
                .order("display_order", { ascending: true });

              setLabels(newLabelsData || []);
            }
          } catch (error) {
            console.error("Error initializing default labels:", error);
          }
        } else {
          setLabels(labelsData);
        }
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const providerToken = sessionData.session?.provider_token;
      const providerRefreshToken = sessionData.session?.provider_refresh_token;

      if (providerToken && !settingsData?.microsoft_access_token) {
        const tokenExpiry = new Date(Date.now() + 3600 * 1000).toISOString();

        if (isNew) {
          await supabase.from("user_settings").insert({
            user_id: user.id,
            general_prompt: defaultPrompt,
            microsoft_access_token: providerToken,
            microsoft_refresh_token: providerRefreshToken,
            microsoft_token_expiry: tokenExpiry,
          });
        } else {
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

      const defaultPrompt =
        "Du bist Assistenz einer Hausverwaltung. Analysiere eingehende E-Mails basierend auf den verfügbaren Kategorien und erstelle professionelle Antwortentwürfe auf Deutsch im 'Sie'-Ton.";
      const promptToSave = generalPrompt.trim() || defaultPrompt;

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
          <LabelCard
            key={label.id}
            label={label}
            onEdit={() => {
              setEditingLabel(label);
              setShowLabelForm(true);
            }}
            onDelete={() => handleDeleteLabel(label.id)}
          />
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

      <AutoClassifySection userId={user?.id} hasLabels={labels.length > 0} />

      <EmailTestSection
        emails={latestEmails}
        selectedEmailId={selectedEmailId}
        loadingEmails={loadingEmails}
        testing={testing}
        hasLabels={labels.length > 0}
        onLoadEmails={handleLoadEmails}
        onSelectEmail={setSelectedEmailId}
        onClassifySelected={handleClassifySelected}
      />
    </div>
  );
}
