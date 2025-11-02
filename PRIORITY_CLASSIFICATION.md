# AI-basierte Prioritäts-Klassifizierung

## Übersicht

Das System klassifiziert jede E-Mail automatisch nach **Dringlichkeit** und setzt die entsprechende **Outlook Importance Flag**:

- 🔴 **Hoch** - Muss sofort beantwortet werden
- 🟡 **Mittel** - Sollte in den nächsten Tagen beantwortet werden
- 🔵 **Niedrig** - Kann eine Woche warten

## 🎯 Wie es funktioniert

### 1. AI-Bewertung

Die AI analysiert den **Inhalt der E-Mail** und bewertet die Dringlichkeit basierend auf:

- **Hoch**: Notfälle, Rechtsfälle mit Fristen, dringende Schäden, Beschwerden mit Eskalation
- **Mittel**: Normale Anfragen, Terminvereinbarungen, reguläre Schadenmeldungen
- **Niedrig**: Allgemeine Infos, nicht dringende Anfragen, Newsletter

### 2. Outlook Integration

Die Priorität wird automatisch in Outlook gesetzt:

| Priorität | Outlook Importance | Visuell                    |
| --------- | ------------------ | -------------------------- |
| Hoch      | `high`             | ❗ Rotes Ausrufezeichen    |
| Mittel    | `normal`           | Keine Markierung           |
| Niedrig   | `low`              | ⬇️ Blauer Pfeil nach unten |

### 3. Classification Response

Die API gibt jetzt auch die Priorität zurück:

```json
{
  "success": true,
  "label": "Schadenmeldung",
  "priority": "Hoch",
  "draftCreated": true
}
```

## 📋 Beispiele

### Beispiel 1: Hohe Priorität

**E-Mail:**

```
Sehr geehrte Damen und Herren,

die Heizung ist seit 5 Tagen komplett ausgefallen. Meine Kinder sind krank
geworden. Ich erwarte bis heute 18 Uhr eine Lösung, sonst werde ich rechtliche
Schritte einleiten und eine Mietminderung geltend machen.
```

**Klassifizierung:**

- Label: `Schadenmeldung` oder `RECHTSSACHE - DRINGEND`
- Priorität: **Hoch** ❗
- Outlook: Rotes Ausrufezeichen

**Begründung:** Eskalation + Frist + Rechtliche Drohung = Sofortige Antwort nötig

---

### Beispiel 2: Mittlere Priorität

**E-Mail:**

```
Guten Tag,

in meiner Wohnung tropft seit gestern der Wasserhahn in der Küche.
Könnten Sie einen Handwerker vorbeischicken?

Vielen Dank!
```

**Klassifizierung:**

- Label: `Schadenmeldung`
- Priorität: **Mittel**
- Outlook: Keine Markierung

**Begründung:** Regulärer Schaden, keine Eskalation, normale Bearbeitung reicht

---

### Beispiel 3: Niedrige Priorität

**E-Mail:**

```
Sehr geehrte Damen und Herren,

ich habe eine Frage zu meiner letzten Nebenkostenabrechnung.
Könnten Sie mir die Aufschlüsselung noch einmal zusenden?

Keine Eile, aber ich würde mich über eine Antwort freuen.
```

**Klassifizierung:**

- Label: `Betriebskosten-Widerspruch`
- Priorität: **Niedrig** ⬇️
- Outlook: Blauer Pfeil

**Begründung:** Info-Anfrage, explizit "keine Eile", kann warten

---

## 🔧 Technische Details

### AI Prompt

Die Klassifizierung enthält jetzt:

```
PRIORITÄT-BEWERTUNG:
- "Hoch": Muss sofort beantwortet werden (Notfälle, Rechtsfälle mit Fristen,
  dringende Schäden, Beschwerden mit Eskalation)
- "Mittel": Sollte in den nächsten Tagen beantwortet werden (normale Anfragen,
  Terminvereinbarungen, reguläre Schadenmeldungen)
- "Niedrig": Kann eine Woche warten (allgemeine Infos, nicht dringende Anfragen,
  Newsletter)

Antworte im JSON-Format mit:
{"label": "...", "create_draft": true/false, "priority": "Hoch"|"Mittel"|"Niedrig"}
```

### Microsoft Graph API Call

```typescript
await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    importance: "high" | "normal" | "low",
  }),
});
```

### Mapping

```typescript
const importanceMap = {
  Hoch: "high",
  Mittel: "normal",
  Niedrig: "low",
};
```

## 📊 In Outlook sichtbar

### Desktop

- **Posteingang**: Ausrufezeichen oder Pfeil neben Betreff
- **Sortierung**: Nach Importance sortierbar
- **Filter**: Nach Wichtigkeit filterbar

### Mobile (iOS/Android)

- **Visuell**: Farbige Markierungen
- **Benachrichtigungen**: Oft lauter/anders bei "high"

### Outlook Web

- **Icons**: Gleiche Darstellung wie Desktop
- **Focused Inbox**: "High" oft in Focused, "Low" oft in Other

## ⚙️ Customization

Falls die AI-Bewertung nicht passt, kannst du in deinem **General Prompt** spezifischere Anweisungen geben:

```
Bei Schäden, die die Wohnqualität beeinträchtigen (Heizung, Wasser, Strom):
Immer "Hoch"

Bei Anfragen von Eigentümern: Mindestens "Mittel"

Bei Newsletter oder Marketing-Mails: Immer "Niedrig"
```

## 🎯 Vorteile

1. **Automatische Priorisierung** - Keine manuelle Sortierung nötig
2. **Visuelle Trennung** - Dringendes auf einen Blick erkennbar
3. **Besseres Zeitmanagement** - Weiß sofort, was zuerst beantwortet werden muss
4. **Kontext-basiert** - AI bewertet Inhalt, nicht nur Label
5. **Outlook-nativ** - Funktioniert mit allen Outlook-Features

## 🧪 Testing

Test mit verschiedenen E-Mail-Typen:

```typescript
// In Settings oder direkt testen:

// Sollte "Hoch" sein:
"Notfall! Wasserschaden in Wohnung 5!";

// Sollte "Mittel" sein:
"Können wir einen Termin für die Wohnungsübergabe vereinbaren?";

// Sollte "Niedrig" sein:
"Newsletter: Neues aus der Immobilienwelt";
```

## 📝 Logs

In der Konsole erscheint jetzt:

```
[Webhook] Successfully classified email AAMk... as Schadenmeldung with priority Hoch
```

## 🔮 Zukünftige Erweiterungen

Mögliche Verbesserungen:

- Priorität im UI der Settings-Seite anzeigen
- Statistiken: Wie viele "Hoch"-Emails pro Woche?
- Custom Rules: User kann eigene Prioritäts-Regeln definieren
- SLA-Tracking: Warnung wenn "Hoch"-Email nicht beantwortet
