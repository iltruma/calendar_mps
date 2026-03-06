# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web app leggera (HTML/CSS/JS vanilla) offline-first per la gestione ferie, ROL e festivita soppresse. Uso singolo utente, dati salvati in localStorage (JSON). Sostituisce il sistema attuale (screenshot in `requirements/`).

## Requisiti

### Funzionalita principali
- Calendario annuale con griglia mesi (righe) x giorni 1-31 (colonne), come in `requirements/image001.png`
- Ogni cella permette di selezionare un tipo di assenza: Ferie (F), ROL (R), Festivita Soppresse (FS)
- Contatori automatici aggiornati ad ogni modifica:
  - Ferie: giorni usati / giorni disponibili (default 20g/anno)
  - ROL: ore usate / ore disponibili (default 56h/anno, 1 ROL = 1h)
  - Festivita Soppresse: giorni usati / giorni disponibili (default 4g/anno)
- Validazione: segnalare quando si superano i giorni/ore a disposizione
- Weekend (sab/dom) evidenziati e bloccati (non selezionabili)
- Festivita nazionali italiane pre-compilate e bloccate (settore bancario)
- Le tipologie di assenza sono 3 per ora ma devono poter crescere nel tempo con logiche ad hoc

### Impostazioni utente
- Budget configurabile per dipendente (giorni ferie, ore ROL, giorni FS)
- Salvataggio/caricamento profili utente in localStorage
- Anno di riferimento selezionabile

### Tecnologia
- HTML/CSS/JS vanilla, nessun framework, nessun build step
- Dati persistiti in localStorage come JSON
- Funziona offline, aprendo index.html direttamente nel browser
- Nessun backend, nessun DB

### Non richiesto (per ora)
- Workflow di approvazione
- Multi-utente / sincronizzazione
- Stampa / export PDF-CSV
- Import dati dal sistema attuale

### Riferimento sistema attuale (da `requirements/`)
- `image001.png`: griglia Piano Assenze con vista annuale
- `unnamed.png`: riepilogo diritti con contatori pianificato/fruito per ogni tipologia

## Development

Nessun build necessario. Aprire `index.html` nel browser.

## Git Commit Guidelines

### Formato del messaggio
```
<tipo>: <descrizione breve>

[corpo opzionale con dettagli sul "perche"]
```

**Tipi consentiti:**
- `feat`: nuova funzionalita
- `fix`: correzione di un bug
- `refactor`: modifica del codice senza cambiare comportamento
- `style`: modifiche CSS / formattazione (no logica)
- `docs`: modifiche alla documentazione
- `chore`: manutenzione (gitignore, config, dipendenze)

### Regole
- Messaggio in inglese, breve e imperativo (es. `feat: add ROL counter validation`)
- Prima riga max 72 caratteri
- Un commit per modifica logica — non mischiare fix e feat nello stesso commit
- Commit atomici: ogni commit deve lasciare l'app in uno stato funzionante

### Sicurezza — cosa NON committare mai
- File `.env`, credenziali, token, API key
- Dati personali di dipendenti reali (nomi, CF, contatti)
- Export di localStorage o dump JSON con dati utente
- File di configurazione locale con path assoluti personali

### .gitignore
Mantenere aggiornato il `.gitignore` per escludere almeno:
- `*.env` / `.env*`
- `node_modules/` (se in futuro si aggiungono dipendenze)
- File di backup degli editor (`*.swp`, `.idea/`, `.vscode/`)

## License

MIT - Copyright (c) 2026 Cosimo Casini
