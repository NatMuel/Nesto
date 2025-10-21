"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
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
      "Du bist Assistenz einer Hausverwaltung. Klassifiziere neue E-Mails als Needs reply / Waiting / FYI. Falls Needs reply, verfasse einen höflichen kurzen Antwortentwurf auf Deutsch im 'Sie'-Ton mit fehlenden Infos und nächsten Schritten.";

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
      setPrompt(settingsData?.classification_prompt || "");

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
            classification_prompt: defaultPrompt,
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

  const handleSave = async () => {
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
        "Du bist Assistenz einer Hausverwaltung. Klassifiziere neue E-Mails als Needs reply / Waiting / FYI. Falls Needs reply, verfasse einen höflichen kurzen Antwortentwurf auf Deutsch im 'Sie'-Ton mit fehlenden Infos und nächsten Schritten.";
      const promptToSave = prompt.trim() || defaultPrompt;

      // Update the settings
      const { error: updateError } = await supabase
        .from("user_settings")
        .update({
          classification_prompt: promptToSave,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }

      setIsFirstTime(false);
      setPrompt(promptToSave);
      setMessage({
        type: "success",
        text: "Prompt erfolgreich gespeichert!",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({ type: "error", text: "Fehler beim Speichern" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);

    try {
      // Get the access token from the session
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.provider_token;

      if (!accessToken) {
        throw new Error(
          "Kein Microsoft-Zugriffstoken gefunden. Bitte melden Sie sich ab und wieder an."
        );
      }

      // Call Microsoft Graph API directly
      const response = await fetch(
        "https://graph.microsoft.com/v1.0/me/messages?$top=5&$select=id,subject,from,receivedDateTime,bodyPreview",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Microsoft Graph API Fehler");
      }

      const data = await response.json();

      setMessage({
        type: "success",
        text: `Verbindung erfolgreich! Gefundene E-Mails: ${data.value.length}`,
      });
    } catch (error: any) {
      console.error("Test error:", error);
      setMessage({
        type: "error",
        text: `Testfehler: ${error.message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleClassifyLatest = async () => {
    setTesting(true);
    setMessage(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.provider_token;

      if (!accessToken) {
        throw new Error("Kein Microsoft-Zugriffstoken gefunden.");
      }

      if (!prompt && !isFirstTime) {
        throw new Error("Bitte speichern Sie zuerst einen Prompt.");
      }

      // Get the latest email
      const response = await fetch(
        "https://graph.microsoft.com/v1.0/me/messages?$top=1&$select=id,subject,from,body,bodyPreview,categories",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Fehler beim Abrufen der E-Mail");
      }

      const data = await response.json();
      if (!data.value || data.value.length === 0) {
        throw new Error("Keine E-Mails gefunden");
      }

      const email = data.value[0];

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
        text: `E-Mail klassifiziert als "${result.category}"! ${
          result.draftCreated ? "Antwortentwurf erstellt." : ""
        } Aktualisieren Sie Outlook.`,
      });
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
              width={50}
              height={50}
              style={{ cursor: "pointer" }}
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

      <div className="card">
        <h2>Klassifizierungs-Prompt</h2>
        <p style={{ color: "#666", marginBottom: "1rem" }}>
          Dieser Prompt wird verwendet, um eingehende E-Mails zu klassifizieren
          und Antwortentwürfe zu erstellen.
        </p>

        {isFirstTime && (
          <div className="info" style={{ marginBottom: "1rem" }}>
            <strong>Erste Einrichtung:</strong> Passen Sie den Prompt nach Ihren
            Wünschen an und klicken Sie auf &quot;Speichern&quot;.
          </div>
        )}

        <label className="label">Ihr Prompt:</label>
        <textarea
          className="textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Du bist Assistenz einer Hausverwaltung. Klassifiziere neue E-Mails als Needs reply / Waiting / FYI. Falls Needs reply, verfasse einen höflichen kurzen Antwortentwurf auf Deutsch im 'Sie'-Ton mit fehlenden Infos und nächsten Schritten."
          rows={10}
        />

        {message && (
          <div className={message.type === "success" ? "success" : "error"}>
            {message.text}
          </div>
        )}

        <button onClick={handleSave} disabled={saving} className="button">
          {saving ? "Speichern..." : "Speichern"}
        </button>
      </div>

      <div className="card">
        <h2>📊 Status</h2>

        <div style={{ marginBottom: "1rem" }}>
          <strong>Verbindung:</strong>{" "}
          <span style={{ color: "#2e7d32" }}>✓ Aktiv</span>
        </div>

        <button
          onClick={handleTest}
          disabled={testing}
          className="button button-secondary"
          style={{ marginBottom: "1rem" }}
        >
          {testing ? "Teste..." : "🧪 Verbindung testen"}
        </button>

        <button
          onClick={handleClassifyLatest}
          disabled={testing}
          className="button"
          style={{ marginBottom: "1rem" }}
        >
          {testing ? "Klassifiziere..." : "✨ Neueste E-Mail klassifizieren"}
        </button>

        <div className="info">
          <strong>Wie es funktioniert:</strong>
          <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
            <li>Neue E-Mails werden automatisch verarbeitet</li>
            <li>Kategorien werden in Outlook angewendet</li>
            <li>Antwortentwürfe erscheinen direkt in Outlook</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <h2>📝 Kategorien</h2>
        <p style={{ marginBottom: "1rem" }}>
          E-Mails werden in diese Kategorien eingeteilt:
        </p>

        <div style={{ marginBottom: "1rem" }}>
          <span className="category-badge category-respond">To respond</span>
          <span style={{ marginLeft: "0.5rem", color: "#666" }}>
            Benötigt eine Antwort (Entwurf wird erstellt)
          </span>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <span className="category-badge category-waiting">Waiting</span>
          <span style={{ marginLeft: "0.5rem", color: "#666" }}>
            Warten auf weitere Informationen
          </span>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <span className="category-badge category-fyi">FYI</span>
          <span style={{ marginLeft: "0.5rem", color: "#666" }}>
            Nur zur Information
          </span>
        </div>
      </div>
    </div>
  );
}
