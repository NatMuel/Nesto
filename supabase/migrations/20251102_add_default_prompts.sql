-- Set default general_prompt for new users
ALTER TABLE public.user_settings
  ALTER COLUMN general_prompt SET DEFAULT 'Du bist Daniel Klat, Mitarbeiter der Hausverwalter IMPERIAL Residential GmbH.

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
10245 Berlin';

-- Function to create default labels for a user
CREATE OR REPLACE FUNCTION public.create_default_labels_for_user(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Only create if user has no labels yet
  IF NOT EXISTS (SELECT 1 FROM public.labels WHERE user_id = p_user_id) THEN
    INSERT INTO public.labels (user_id, name, description, draft_prompt, color, display_order, created_at, updated_at)
    VALUES
      (
        p_user_id,
        'Schadenmeldung',
        'E-Mails von Mietern, die Schäden in der Wohnung oder am Gebäude melden (z.B. Wasserschaden, defekte Heizung, kaputte Fenster, Schimmel, etc.)',
        'Erstelle eine höfliche Antwort, die:
- Den Eingang der Schadenmeldung bestätigt
- Um Details bittet falls nötig (Fotos, genaue Beschreibung, seit wann)
- Erklärt, dass ein Handwerker beauftragt wird
- Einen ungefähren Zeitrahmen nennt (z.B. "innerhalb der nächsten 3-5 Werktage")
- Notfallkontakt nennt bei dringenden Fällen',
        'preset24',
        1,
        NOW(),
        NOW()
      ),
      (
        p_user_id,
        'Mietminderung',
        'E-Mails von Mietern, die eine Mietminderung ankündigen oder beantragen, z.B. wegen Mängeln, Lärm, Bauarbeiten oder anderen Beeinträchtigungen',
        'Erstelle eine diplomatische Ablehnung, die:
- Die Anfrage zur Kenntnis nimmt
- Höflich aber bestimmt erklärt, dass die Voraussetzungen für eine Mietminderung nicht vorliegen
- Darauf hinweist, dass der gemeldete Mangel behoben wird/wurde
- Auf die vertraglichen Pflichten hinweist
- Anbietet, die Situation zu besprechen falls der Mieter weitere Fragen hat',
        'preset1',
        2,
        NOW(),
        NOW()
      ),
      (
        p_user_id,
        'Betriebskosten-Widerspruch',
        'E-Mails von Mietern, die der Betriebskostenabrechnung widersprechen oder Fragen zur Abrechnung haben',
        'Erstelle eine sachliche Antwort, die:
- Den Widerspruch zur Kenntnis nimmt
- Um konkrete Angaben bittet, welche Positionen angezweifelt werden
- Anbietet, die Abrechnung im Detail zu erläutern
- Auf die Einsichtnahme in Belege hinweist (falls gewünscht)
- Einen Termin für ein Gespräch anbietet',
        'preset3',
        3,
        NOW(),
        NOW()
      ),
      (
        p_user_id,
        'Beschwerde (Nachbarn/Dienstleister)',
        'E-Mails mit Beschwerden über Nachbarn (Lärm, Störungen) oder über Dienstleister (Hausmeister, Reinigung, etc.)',
        'Erstelle eine verständnisvolle Antwort, die:
- Die Beschwerde ernst nimmt
- Um Details bittet (Wann? Wie oft? Welche Art von Störung?)
- Bei Nachbarbeschwerden: Erklärt, dass das Gespräch gesucht wird
- Bei Dienstleistern: Verspricht, die Qualität zu überprüfen
- Um Dokumentation bittet (Lärmprotokoll, Fotos)
- Nächste Schritte aufzeigt',
        'preset4',
        4,
        NOW(),
        NOW()
      ),
      (
        p_user_id,
        'Terminvereinbarung',
        'E-Mails zur Vereinbarung von Terminen: Wohnungsbesichtigungen, Übergaben, Begehungen, persönliche Gespräche',
        'Erstelle eine kurze, freundliche Antwort, die:
- 2-3 Terminvorschläge macht (verschiedene Wochentage, vormittags/nachmittags)
- Nach Präferenzen fragt
- Den Ort und voraussichtliche Dauer nennt
- Bittet, einen Termin zu bestätigen',
        'preset5',
        5,
        NOW(),
        NOW()
      ),
      (
        p_user_id,
        'Kündigung (Mieter)',
        'E-Mails von Mietern, die ihre Wohnung kündigen oder Fragen zur Kündigung haben',
        'Erstelle eine formelle Antwort, die:
- Die Kündigung bestätigt
- Die Kündigungsfrist und das Kündigungsdatum nennt
- Auf wichtige nächste Schritte hinweist (Nachmieter, Übergabe, Schönheitsreparaturen)
- Um Bestätigung der Kontodaten für Kautionsrückzahlung bittet
- Einen Termin für die Wohnungsübergabe vorschlägt',
        'preset6',
        6,
        NOW(),
        NOW()
      ),
      (
        p_user_id,
        'Handwerker-Angebot/Rechnung',
        'E-Mails von Handwerkern mit Angeboten, Rechnungen oder Rückfragen zu Aufträgen',
        'Erstelle eine kurze geschäftliche Antwort, die:
- Den Eingang bestätigt
- Bei Angeboten: Prüfung ankündigt und Rückmeldung innerhalb von X Tagen verspricht
- Bei Rechnungen: Prüfung und Weiterleitung zur Zahlung bestätigt
- Bei Rückfragen: Informationen liefert oder um Details bittet',
        'preset7',
        7,
        NOW(),
        NOW()
      ),
      (
        p_user_id,
        'Eigentümer-Anfrage',
        'E-Mails von Eigentümern mit Fragen zu Leerständen, Projektstatus, Vermietung, Finanzen oder Terminwünschen',
        'Erstelle eine professionelle, detaillierte Antwort, die:
- Aktuellen Stand/Status ausführlich beschreibt
- Konkrete Zahlen/Fakten nennt (falls im Kontext vorhanden)
- Nächste Schritte und Zeitplan aufzeigt
- Proaktiv relevante Zusatzinformationen anbietet
- Bei Terminwünschen: Mehrere Optionen vorschlägt',
        'preset13',
        8,
        NOW(),
        NOW()
      ),
      (
        p_user_id,
        'RECHTSSACHE - DRINGEND',
        'Rechtliche Angelegenheiten mit Fristen: Mietpreisbremse, Kündigungen/Räumungen, Mahnbescheide, Klagen, Anwaltschreiben. Diese E-Mails haben höchste Priorität!',
        'Erstelle eine SEHR sorgfältige Antwort, die:
- Die rechtliche Relevanz und Dringlichkeit betont
- Auf bestehende Fristen explizit hinweist
- Empfiehlt, ggf. Rechtsanwalt einzuschalten
- Dokumentiert, welche Unterlagen benötigt werden
- WICHTIG: Vorsichtig formulieren, keine rechtlichen Zusagen machen
- Schnellstmögliche Bearbeitung zusichert',
        'preset0',
        9,
        NOW(),
        NOW()
      ),
      (
        p_user_id,
        'Posteingang (gescannt)',
        'Eingescannte Briefe, die von der Büroassistenz per E-Mail weitergeleitet wurden. Kann verschiedenste Inhalte haben (Behördenschreiben, Rechnungen, Mitteilungen, etc.)',
        'Erstelle eine interne Zusammenfassung (keine externe E-Mail), die:
- Den Inhalt jedes Briefes kurz zusammenfasst (1-2 Sätze pro Brief)
- Die Absender nennt
- Wichtige Daten/Fristen hervorhebt
- Handlungsempfehlung gibt (z.B. "Rechnung prüfen und bezahlen", "Termin wahrnehmen", "Rechtlich prüfen lassen")
- Priorität einschätzt (Hoch/Mittel/Niedrig)',
        'preset20',
        10,
        NOW(),
        NOW()
      ),
      (
        p_user_id,
        'Sonstiges / Zur Info',
        'Alle anderen E-Mails: Newsletter, Werbung, allgemeine Informationen, nicht kategorisierbare Anfragen. Keine Antwort nötig.',
        'Diese E-Mail benötigt keine Antwort. Nur zur Information ablegen.',
        'preset17',
        11,
        NOW(),
        NOW()
      );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_default_labels_for_user(UUID) TO authenticated;

