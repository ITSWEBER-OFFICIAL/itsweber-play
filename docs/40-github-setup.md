# GitHub Setup — Safe für Anfänger

Schritt-für-Schritt-Guide, um ITSWEBER Play sicher auf GitHub zu veröffentlichen.
Du hast bereits einen Account + eine ITSWEBER-Organisation — perfekt.

**Ziel:** Repository `ITSWEBER/itsweber-play` (public), mit Schutz gegen
versehentliche Secret-Leaks, Push-Schutz auf `main`, signierte Commits
optional, CI die jeden Push prüft.

## Reihenfolge (ca. 30 Min)

### 1. SSH-Key für GitHub (einmalig, Windows)

GitHub-Pushes über SSH sind sicherer als HTTPS + Token. Deine Keys bleiben lokal.

```bash
# Im Git-Bash oder PowerShell:
ssh-keygen -t ed25519 -C "info@itsweber.de" -f ~/.ssh/id_ed25519_github
# Passphrase vergeben — wichtig! (nicht leer lassen)
```

Public-Key kopieren:

```bash
cat ~/.ssh/id_ed25519_github.pub
```

→ GitHub → Settings → SSH and GPG keys → New SSH key → einfügen.

SSH-Config festschreiben (`~/.ssh/config`):

```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github
  AddKeysToAgent yes
```

Test: `ssh -T git@github.com` → „Hi Benjamin! You've successfully authenticated..."

### 2. ITSWEBER-Organisation absichern

In GitHub → Deine Orga → Settings:

| Punkt | Wert | Warum |
|---|---|---|
| **Member privileges → Base permissions** | `Read` | Team-Member können nicht versehentlich pushen |
| **Two-factor authentication → Require 2FA** | ON | Schutz gegen Account-Takeover |
| **Code, planning, and automation → Actions → Policies** | „Allow enterprise, and select non-enterprise, actions" | Nur vertrauenswürdige Actions |
| **Code security → Secret scanning → Enable** | ON | GitHub warnt, wenn jemand versehentlich einen Token committed |
| **Code security → Push protection** | ON | Blockiert Pushes mit erkannten Secrets **bevor** sie im Repo landen |
| **Code security → Dependabot alerts / security updates** | ON | Warnt bei anfälligen Dependencies |

### 3. Repository erstellen (leer)

GitHub → Neue Orga → „New repository"

- **Name:** `itsweber-play`
- **Visibility:** Private (erstmal). Public-Switch nach Session L.
- **Description:** „Maximal anpassbare Video-Plattform — Next.js + Fastify + Postgres + MinIO"
- **Add README/license/.gitignore:** ❌ **ALLE DREI AUS.** Du hast lokal schon alles.

### 4. Lokal als Git-Repo initialisieren

Im Projekt-Root:

```bash
cd "c:/Users/itswe/Documents/ITSWEBER/Projekte/ITSWEBER Play Docker"
git init
git branch -M main
git remote add origin git@github.com:ITSWEBER/itsweber-play.git
```

### 5. .gitignore prüfen (KRITISCH — das ist der „Kein Secret im Repo"-Schutz)

```bash
# Muss enthalten:
.env
.env.*
!.env.example
!.env.production.example
node_modules/
.next/
dist/
out/
*.log
.DS_Store
previews/  # Design-Dummies, nicht Teil des Releases
```

Check, ob `.env` nicht getrackt ist:

```bash
git check-ignore -v .env
```

→ muss `.gitignore:N:.env\t.env` zurückgeben.

### 6. Secret-Scan vor dem ersten Push (Trufflehog)

```bash
# Windows via Docker (kein Native-Install nötig):
docker run --rm -v "$(pwd):/pwd" trufflesecurity/trufflehog:latest filesystem /pwd --no-update --only-verified
```

→ Ausgabe MUSS leer sein (keine `FOUND`-Einträge).

Falls was gefunden wird: **nicht pushen**, Geheimnis rotieren, aus Code entfernen, dann erneut scannen.

### 7. Ersten Commit + Push

```bash
git add .
git status  # Doppelt-Check: keine .env drin
git commit -m "chore: initial import — ITSWEBER Play v0.4.0-dev"
git push -u origin main
```

### 8. Branch-Protection auf `main` einschalten

Repo → Settings → Branches → „Add branch protection rule":

- **Branch name pattern:** `main`
- ☑ Require a pull request before merging
  - ☑ Require approvals: 1 (bei Solo-Arbeit kannst du auch 0 lassen, aber mind. Review-Checkbox)
  - ☑ Require conversation resolution before merging
- ☑ Require status checks to pass before merging
  - (Checks werden in Session L via GitHub-Actions-CI aktiv — erstmal leer lassen)
- ☑ Require signed commits (optional, wenn du GPG/SSH-Signing hast)
- ☑ Do not allow bypassing the above settings (auch nicht für Admins)
- ☑ Restrict who can push to matching branches → Nur du (oder leer lassen für Solo)

### 9. Commit-Signing aktivieren (optional aber empfohlen)

Bei jedem Commit erscheint dann ein „Verified"-Siegel auf GitHub.

```bash
# SSH-Signing (einfacher als GPG) — wiederverwendet den GitHub-SSH-Key:
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519_github.pub
git config --global commit.gpgsign true
```

GitHub → Settings → SSH and GPG keys → Den gleichen Key nochmal als „Signing key" hinzufügen.

### 10. Sichere Env-Basis

- **Niemals echte Secrets in `.env.example` oder `.env.production.example`** — nur Platzhalter.
- Echte Secrets für den Unraid-Deploy kommen NUR in die `.env` auf dem Server (nicht im Repo).
- Für CI/CD (Session L): GitHub → Repo → Settings → Secrets and variables → Actions → pro Secret eine Row.

## Was passiert in Session L

Session L richtet das drumherum ein, das wir hier vorbereitet haben:

- GitHub-Actions-CI (typecheck/lint/build bei jedem Push)
- Container-Images automatisch zu GitHub Container Registry pushen (`ghcr.io/itsweber/itsweber-play`)
- Dependabot-Konfiguration (`.github/dependabot.yml`)
- Release-Tags + Changelog-Generierung
- Unraid-Community-Store-XML submitten

## Notfall: Versehentlich ein Secret gepusht

1. **Secret SOFORT rotieren** (DB-Passwort, API-Key, was auch immer) — `git push --force` rettet nichts, GitHub indexiert die History.
2. Im Repo entfernen + neuer Commit.
3. Wenn es im aktuellen `main` ist: `git revert` + push.
4. Wenn es länger im Repo war: BFG Repo-Cleaner oder `git filter-repo` — aufwendig. Daher Schritt 6 (Secret-Scan) **vor** jedem Push.

## Fertig-Check

Nach diesem Guide hast du:

- ✅ SSH-Key für GitHub konfiguriert
- ✅ Orga hat 2FA erzwungen, Secret-Scanning + Push-Protection aktiv
- ✅ Lokales Repo mit sauberem .gitignore
- ✅ Branch-Protection auf `main`
- ✅ Optional: signierte Commits
- ✅ Keine Secrets im History

Danach kannst du beruhigt Session L starten.
