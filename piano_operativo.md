# Piano Operativo: Sistema di Tracciamento Eventi (Architettura Sicura)

Questo documento delinea il piano operativo step-by-step per sviluppare ed eseguire il deployment dell'architettura completa del sistema di tracciamento eventi, che include autenticazione e validazione dei payload.

## Architettura di Riferimento
L'architettura si evolve in un paradigma a microservizi supportato da tecnologie specializzate.

- **Browser Plugin (`linkedin-suggestor`, TypeScript, Manifest V3)**: Raccoglie i dati della pagina (Content Script) e li invia a intervalli regolari, ad esempio ogni minuto (Background Service Worker). Firma i payload tramite HMAC-SHA256 usando un secret di sessione isolato allocato su `chrome.storage.local`.
- **Auth Service (Go)**: Gestisce la registrazione e il login. Salva gli utenti su PostgreSQL (password in bcrypt). Genera i JWT (RS256) per l'autenticazione e un token custom randomico (signing secret) per la firma HMAC da salvare temporaneamente in Redis, con medesimo TTL del JWT.
- **Event Service (Go + Fiber)**: L'API che riceve gli eventi in modo veloce. Delega le logiche di autenticazione ai due middleware: *JWT Middleware* (identità e chiave pubblica) e *HMAC Middleware* (integrità del contenuto prelevato da Redis).
- **Coda e Secret Store (Redis)**: Oltre ad agire come buffer veloce dove l'Event Service inietta provvisoriamente gli eventi per la successiva scrittura, ospita i secret di firma volatili generati dall'Auth Service.
- **Worker (Go routine)**: Periodicamente (es. ogni 10s) svuota la coda persistendo eventi confermati.
- **Database Grafi (Neo4j)**: Archivia nodi (Utenti, Pagine) e relative connessioni (VISITED).
- **Database Relazionale (PostgreSQL)**: Persiste in sicurezza gli account utente per la piattaforma base.

---

## Fase 1: Setup Infrastruttura e Docker Compose
1. **Repository e Struttura**: Creare l'architettura base delle directory contenente `plugin`, `auth-service` ed `event-service`.
2. **Setup Docker Compose**:
    - Aggiungere l'immagine per **Neo4j** per i grafi aziendali (porta 7474 per l'UI, 7687 per la connessione).
    - Aggiungere l'immagine per **Redis** per fare da coda eventi e memoria rapida dei secret.
    - Aggiungere l'immagine per **PostgreSQL** per gestire le persistenza solida dell'Auth Service.
3. **Avvio**: Lancio del comando `docker-compose up -d`.

## Fase 2: Implementazione Auth Service (Go)
1. **Bootstrapping**: Inizializzare il modulo per l'Auth Service (`go mod init auth-service`).
2. **Connessione ai Sistemi Caching/Data**: 
   - Connessione a PostgreSQL con applicazione rapida di migrazione tabella `users`.
   - Connessione a Redis.
3. **Endpoint di Registrazione**: Validazione basilare di formati, hash della password usando bcrypt e commit su DB relazionale.
4. **Endpoint di Login**: 
   - Login contro le tabelle su PG.
   - Creazione del JWT crittografato asimmetricamente con chiave privata RS256.
   - Produzione di un `signing_secret` (hex code 32 byte) per la firma dei payload successivi.
   - Cache su Redis del secret relazionato alla sessione (e apposito TTL). Ritorno al client di tale set.
5. **Rotazione / Refresh Token**: Endpoint per riottenere il set evitando login prolungati a tempo esaurito.

## Fase 3: Implementazione Event Service e Worker (Go)
1. **Bootstrapping**: Inizializzare il modulo (`go mod init event-service`).
2. **Sviluppo dei Middleware di Sicurezza**:
   - **JWT Middleware**: Verifica la token validity attraverso la public key esposta (JWKS o precondivisa), estraendo lo `user_id`.
   - **HMAC Middleware**: Usa il `user_id` per prendere da Redis l'identity secret, ricalcola nel processo Fiber l'hash locale HMAC-SHA256, rigettando le differenze rispetto a `X-Signature`.
3. **Endpoint Eventi (`/events`)**: I payload sicurizzati vengono tradotti in blob serializzati su lista Redis e processati istantaneamente con feedback 200 OK.
4. **Sviluppo Worker (Flush db)**: Implementato in background routine, fa pop in batch sul namespace di messaggi. Stabilisce l'estrazione su Neo4j con Driver nativo tramite costrutti transazionali Cypher.

## Fase 4: Integrazione Browser Plugin (`linkedin-suggestor`) (Manifest V3)
1. **Raccolta tramite Content Script**: Adattare le variabili necessarie dalla Window Web ai processi attivi di visualizzazione dei portali target.
2. **Service Worker e Gestione Sessione (Background)**:
   - Mettere in cache localmente l'accoppiata di JWT e Signing Secret resi dall'Auth Service.
   - Setup di `chrome.alarms` per generare una routine costante al Dispatch log eventi (ogni minuto).
   - Introduzione Web Crypto API: Eseguire la funzione di hashing col secret salvato applicato alla conversione byte-level JSON limitato ai campi da esportare.
3. **Flusso Autenticato**: Implementare nel chiamante il setup degli Header per presentare JWT (`Authorization: Bearer <...>`) ed `X-Signature` nella POST HTTP. Gestione casi ritentabili o invalidati.

## Fase 5: Consolidamento e Sicurezza Continua
1. **Gestione Variabili e Secrets**: Importare variabili di sistema (DB Uri, Porte, Config, Chiavi private di base) rimuovendole interamente a repository.
2. **Trasporto TLS e Network Security**: Richiedere un binding `HTTPS` tramite `mkcert` così da simulazione cifratura locale delle password passate o del payload limitando il plain-text sniffing.
3. **Graceful Shutdown**: Disconnessioni corrette tramite pool close sulle socket TCP di Postgres, Neo4j e Redis alla pressione di controlli d'uscita al terminale nativo in Go.
4. **Rate Limiting**: Posizionare middleware accessorio per frenare richieste al medesimo endpoint e per il medesimo user_id che sfondano una soglia accettata di frequenza limitando script malevoli. Valutare Cifratura E2E nativa al payload in passaggi produttivi finali.
