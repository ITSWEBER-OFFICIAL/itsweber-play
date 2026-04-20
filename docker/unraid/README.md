# Unraid — 1-Click Install Template

Diese XML-Datei definiert alle Felder für den Unraid-Docker-Dialog
(Name, Image, Netzwerk, Volumes, Env-Vars) — Du fügst nur eine URL
hinzu und hast alle Felder automatisch vorausgefüllt.

## Install — Community Applications (empfohlen)

Wenn das CA-Plugin installiert ist (zukünftig, nach CA-Store-Merge):

**Apps → Suche nach `ITSWEBER Play` → Install**

## Install — Template-URL (direkt aus diesem Repo)

1. Unraid Web-UI → **Docker**-Tab → **„Add Container"**
2. **Ins Feld „Template" diese URL einfügen**:
   ```
   https://raw.githubusercontent.com/ITSWEBER-OFFICIAL/itsweber-play/main/docker/unraid/itsweber-play.xml
   ```
3. Unraid lädt alle Felder → nur noch Secrets + Public-URL eintragen:
   - **Auth Secret** (`openssl rand -hex 32`)
   - **Postgres Password** (`openssl rand -hex 24`)
   - **MinIO Root Password** (`openssl rand -hex 24`)
   - **S3 Secret Key** — identisch zu MinIO Root Password
   - **Initial Admin Password** — starkes Passwort
   - **Public URL** — deine externe HTTPS-Domain
4. **Apply** → Unraid pullt das Image von GHCR und startet den Container
5. Öffne `http://<server>:3000/setup` → 9-Step-Wizard durchlaufen

## Netzwerk-Varianten

- **Bridge** (Default im Template): Port 3000 auf Host publisht. Reverse-
  Proxy (NPM / Traefik / Caddy) forwardet `deine-domain.tld` zu
  `http://<unraid>:3000`.
- **Macvlan / br0 / custom VLAN**: Im Dialog Netzwerktyp auf
  `Custom: br1` (oder Dein Netzwerk) ändern und eine freie IP setzen.
  Port-Mapping dann entfernen.

## Upgrade

Unraid Docker-Tab → Container → **Force Update** — zieht das neueste
`:main`-Image aus GHCR.

## Troubleshooting

- **Pull failed (unauthorized):** GHCR-Paket muss public sein
  (Org-Policy unter `https://github.com/organizations/ITSWEBER-OFFICIAL/settings/packages`).
- **Container startet nicht:** Im Docker-Tab das Container-Icon
  anklicken → **Logs** → meist fehlt ein Secret (`AUTH_SECRET`,
  `POSTGRES_PASSWORD`).
- **502 vom Reverse-Proxy:** WebSocket-Upgrade + `client_max_body_size ≥
  8g` in der Proxy-Config prüfen.
