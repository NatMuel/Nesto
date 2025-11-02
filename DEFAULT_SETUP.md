# Default Setup für neue User

## Übersicht

Neue User erhalten automatisch beim ersten Login:

- ✅ **11 vorkonfigurierte Labels** mit Beschreibungen und Draft-Prompts
- ✅ **General Prompt** mit IMPERIAL-spezifischen Anweisungen und Impressum

## 🚀 Wie es funktioniert

### 1. Migration

Die Migration `20251102_add_default_prompts.sql` enthält:

- **Default General Prompt** in der `user_settings` Tabelle
- **PostgreSQL-Funktion** `create_default_labels_for_user()` zum Erstellen der Standard-Labels

### 2. Automatische Initialisierung

Beim ersten Besuch der Settings-Seite:

1. System prüft, ob User Labels hat
2. Falls keine Labels → API Call zu `/api/init-defaults`
3. API ruft die PostgreSQL-Funktion auf
4. 11 Standard-Labels werden erstellt
5. Labels werden automatisch geladen und angezeigt

### 3. API Endpoint

`/api/init-defaults` (POST):

- Authentifizierung erforderlich
- Prüft ob User schon Labels hat
- Erstellt Labels nur wenn noch keine vorhanden
- Gibt Status und Anzahl erstellter Labels zurück

## 📋 Standard-Labels

| #   | Name                                | Farbe            | Beschreibung                            |
| --- | ----------------------------------- | ---------------- | --------------------------------------- |
| 1   | Schadenmeldung                      | preset24 (Rot)   | Mängel und Schäden in Wohnungen         |
| 2   | Mietminderung                       | preset1 (Rot)    | Anfragen zur Mietminderung              |
| 3   | Betriebskosten-Widerspruch          | preset3 (Orange) | Widersprüche zu Abrechnungen            |
| 4   | Beschwerde (Nachbarn/Dienstleister) | preset4 (Gelb)   | Beschwerden über Nachbarn/Dienstleister |
| 5   | Terminvereinbarung                  | preset5 (Grün)   | Termine für Besichtigungen, Übergaben   |
| 6   | Kündigung (Mieter)                  | preset6 (Blau)   | Kündigungen von Mietern                 |
| 7   | Handwerker-Angebot/Rechnung         | preset7 (Lila)   | Angebote und Rechnungen                 |
| 8   | Eigentümer-Anfrage                  | preset13 (Pink)  | Anfragen von Eigentümern                |
| 9   | RECHTSSACHE - DRINGEND              | preset0 (Rot)    | Rechtliche Fälle mit Fristen            |
| 10  | Posteingang (gescannt)              | preset20 (Braun) | Eingescannte Briefe                     |
| 11  | Sonstiges / Zur Info                | preset17 (Grau)  | Sonstige E-Mails ohne Antwort           |

## 📝 General Prompt

```
Du bist Daniel Klat, Mitarbeiter der Hausverwalter IMPERIAL Residential GmbH.

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

[+ IMPERIAL Impressum wird automatisch hinzugefügt]
```

## 🔧 Migration ausführen

### Lokal (Supabase CLI):

```bash
cd /Users/nataniel/nesto
supabase db push
```

### Produktion (Supabase Dashboard):

1. Gehe zu **SQL Editor**
2. Öffne `supabase/migrations/20251102_add_default_prompts.sql`
3. Kopiere den Inhalt
4. Führe im Dashboard aus

## ✅ Bestehende User

**Keine Auswirkung** auf bestehende User:

- Bestehende Labels bleiben unverändert
- Bestehende General Prompts bleiben erhalten
- Nur neue User (ohne Labels) erhalten das Default-Setup

## 🧪 Testen

1. Neuen Test-User erstellen
2. Mit Microsoft-Account einloggen
3. Zu `/settings` navigieren
4. Labels sollten automatisch erscheinen
5. General Prompt sollte vorbefüllt sein

## 🎯 Anpassungen

### Neue Labels für alle neuen User:

1. Bearbeite `supabase/migrations/20251102_add_default_prompts.sql`
2. Füge neue Labels zur `create_default_labels_for_user()` Funktion hinzu
3. Führe Migration aus

### General Prompt ändern:

1. Ändere `ALTER TABLE public.user_settings ALTER COLUMN general_prompt SET DEFAULT '...'`
2. Führe Migration aus

**Wichtig:** Bestehende User müssen ihre Prompts manuell anpassen!

## 🔒 Sicherheit

- ✅ Funktion mit `SECURITY DEFINER` - läuft mit Owner-Rechten
- ✅ `GRANT EXECUTE` nur für `authenticated` Users
- ✅ Funktion prüft ob User schon Labels hat (verhindert Duplikate)
- ✅ API Endpoint validiert Authentifizierung

## 📊 Monitoring

Logs zu prüfen:

```sql
-- Wie viele User haben Default-Labels?
SELECT COUNT(DISTINCT user_id)
FROM labels
WHERE name IN ('Schadenmeldung', 'Mietminderung', 'RECHTSSACHE - DRINGEND');

-- Welche User haben noch keine Labels?
SELECT u.id, u.email
FROM auth.users u
LEFT JOIN labels l ON u.id = l.user_id
WHERE l.id IS NULL;
```
