# Implementazione Login: Soluzione B (Web App Dedicata)

Questo documento traccia gli step operativi per sviluppare l'autenticazione tramite una web app esterna, che passerà le credenziali al plugin in modo sicuro.

## Step Operativi

### Fase 1: Aggiornamento dell'Auth Service (Go)
1. **Modifica Modello Utente (PostgreSQL):**
   - Aggiungere al database i campi per gestire utenti che si iscrivono tramite identity provider esterni (es. `linkedin_id`, `avatar_url`, `auth_provider`).
   - Questo permette di avere account collegati a LinkedIn che non hanno per forza una password (se decidete di rimuovere l'obbligatorietà della password per OAuth).
2. **Integrazione OAuth2 LinkedIn nell'Auth Service:**
   - Creare un'app nel [LinkedIn Developer Portal](https://developer.linkedin.com/).
   - Aggiungere l'endpoint `/auth/linkedin/login` che reindirizza al flusso OAuth di LinkedIn.
   - Aggiungere l'endpoint `/auth/linkedin/callback` che riceve il code, chiede i dati a LinkedIn e completa la registrazione/login interno, generando il JWT.
3. **Gestione del Segreto (HMAC):**
   - Analogamente al flusso Email/Pass, ogni login (anche da LinkedIn) deve generare il Secret (salvato poi in Redis) e ritornato nel payload HTTP alla Web App per poi essere girato al Plugin.

### Fase 2: Creazione Web App (Login / Dashboard)
1. **Piattaforma:** Sviluppare una web app ospitata sul proprio dominio (es. `https://app.tuodominio.com`).
2. **Interfaccia:** 
   - Un form per iscrizione/login standard (Email e Password).
   - Un bottone ben visibile "Accedi con LinkedIn".
3. **Passaggio Dati al Plugin:**
   - Una volta fatto il login, la pagina web ha in memoria (o nel local storage del dominio) il JWT e il Signing Secret ritornati dall'Auth Service.
   - Inviare questi dati al Plugin usando le API web fornite da Chrome per estensioni configurate in `externally_connectable` nel Manifest.
   - Codice di esempio (frontend web):
     ```javascript
     const extensionId = "tuo_id_estensione_qui";
     chrome.runtime.sendMessage(extensionId, { 
       action: "LOGIN_SUCCESS", 
       jwt: "xxx.yyy.zzz", 
       secret: "hex_secret" 
     }, (response) => {
       console.log("Plugin notificato con successo", response);
     });
     ```

### Fase 3: Aggiornamento Plugin Browser (Estensione)
1. **Manifest V3:** Abilitare il dominio della web app per inviare messaggi al background script dell'estensione.
   ```json
   "externally_connectable": {
     "matches": ["https://app.tuodominio.com/*"]
   }
   ```
2. **Ricezione Dati (Background Script):**
   - Intercettare il messaggio, salvare il JWT e l'HMAC secret in `chrome.storage.local`.
   ```javascript
   chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
       if (request.action === "LOGIN_SUCCESS" && request.jwt && request.secret) {
           chrome.storage.local.set({ jwt: request.jwt, hmacSecret: request.secret }, () => {
               sendResponse({ status: "success" });
               // Avvia gli strumenti di AI e polling degli eventi qui
           });
       }
   });
   ```
3. **Comportamento UI Popup:** Se l'utente apre il popup in alto a destra nel browser, l'app legge il `chrome.storage.local`. Se non ha il token, mostra un tasto che apre un nuovo tab in `https://app.tuodominio.com/login`. Se ce l'ha, mostra l'interfaccia sbloccata.

---

## Comandi di Avvio Locale

Assicurati di trovarti nella directory radice del progetto: `/Users/simonezoppello/Documents/lavoro/jouledev/workspaces/varie-llm/linkedin-commentator-server-trying`.

### 1. Avviare l'Infrastruttura Dati (Docker Compose)
Tira su PostgreSQL, Redis e Neo4j.
```bash
docker-compose up -d
```
*Porte operative principali:*
- **PostgreSQL:** `5432`
- **Redis:** `6379`
- **Neo4j:** `7687` (Bolt) / `7474` (UI browser HTTP per query, usa le credenziali di default o impostate in locale per esaminare graficamente i nodi).

### 2. Avviare l'Auth Service
L'Auth Service gestirà le API di registrazione, login e OAuth LinkedIn.

Apri un nuovo terminale, esegui:
```bash
cd auth-service
go run main.go
```
*(L'Auth Service resterà in ascolto, solitamente sulla porta definita nel suo codice, es. 8080).*

### 3. Avviare l'Event Service
L'Event Service raccoglie i log e popola Neo4j.

Apri un nuovo terminale, esegui:
```bash
cd event-service
go run main.go
```
*(L'Event Service solitamente usa una porta diversa, es. 8081).*

Ora tutto il sistema di backend è attivo. 

### 4. Creare e Avviare la Web App (Next.js)
Per ora svilupperemo solo il modulo di login usando React e Next.js.

Apri un nuovo terminale nella cartella root del progetto (`linkedin-commentator-server-trying`) ed esegui i comandi seguenti per inizializzare il progetto Next.js:

```bash
# Crea un nuovo progetto Next.js (chiamato ad esempio 'web-app')
npx create-next-app@latest web-app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```
Durante l'installazione accetta le impostazioni di default proposte.

Una volta terminata l'installazione, entra nella cartella e avvia il server di sviluppo:
```bash
cd web-app
npm run dev
```
*(La web app sarà attiva su `http://localhost:3000` e potrai iniziare a sviluppare l'interfaccia di login al suo interno).*
