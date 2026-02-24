# Architettura — Browser Plugin Event Collection System

## Panoramica

Il sistema è composto da tre macro-componenti: un **browser plugin** che raccoglie e invia eventi di navigazione, un **Auth Service** che gestisce identità e credenziali, e un **Event Service** che riceve, valida e persiste gli eventi. La comunicazione tra i componenti è protetta tramite JWT e firma HMAC dei payload.

---

## Componenti

### Browser Plugin

Il plugin opera su Manifest V3 e si divide in due parti:

- **Content Script** — legge i dati dalla pagina attiva (URL, titolo, azioni utente, contenuti)
- **Background Service Worker** — gestisce il ciclo di vita, il timer di invio tramite `chrome.alarms`, e la comunicazione con i servizi backend

Il plugin mantiene in `chrome.storage.local` il JWT e il signing secret ricevuti al momento del login. Ogni minuto costruisce un payload con i dati raccolti, lo firma con HMAC-SHA256 usando il signing secret, e lo invia all'Event Service allegando JWT e firma negli header.

### Auth Service (Go)

Microservizio Go responsabile di registrazione, login e gestione dei secret di firma. Espone le seguenti funzionalità:

- **Registrazione** — riceve email e password, salva l'utente su PostgreSQL con password hashata tramite bcrypt
- **Login** — verifica le credenziali, genera un JWT firmato e un signing secret casuale (32 byte, hex-encoded), salva il signing secret su Redis con TTL pari alla durata del JWT, restituisce entrambi al plugin
- **Refresh** — rigenera JWT e signing secret, aggiorna Redis

Il signing secret non viene mai persistito su PostgreSQL ma esclusivamente su Redis, dove è accessibile con latenza minima dall'Event Service.

### Event Service (Go)

Microservizio Go responsabile della ricezione e processamento degli eventi. Non gestisce autenticazione propria ma delega la verifica a due middleware in sequenza:

- **JWT Middleware** — verifica la validità e la firma del token usando la chiave pubblica dell'Auth Service; estrae lo user_id e lo rende disponibile al handler successivo
- **HMAC Middleware** — recupera il signing secret dell'utente da Redis, ricalcola la firma HMAC-SHA256 sul body della richiesta e la confronta con quella nell'header `X-Signature`; se non corrisponde la richiesta viene rifiutata

Solo le richieste che superano entrambi i middleware vengono processate. Il handler inserisce l'evento in una coda Redis. Un worker Go in background svuota la coda ogni 10 secondi e scrive i nodi e le relazioni su Neo4j tramite query Cypher.

---

## Stack Tecnologico

| Layer | Tecnologia |
|---|---|
| Browser Plugin | TypeScript, Manifest V3, Web Crypto API |
| Auth Service | Go, PostgreSQL, Redis, bcrypt, JWT (RS256) |
| Event Service | Go, Fiber, Redis, Neo4j |
| Database utenti | PostgreSQL |
| Buffer eventi | Redis |
| Database grafi | Neo4j |
| Infrastruttura locale | Docker Compose |

---

## Sicurezza

### JWT (RS256)

L'Auth Service firma i token con una chiave privata RSA. L'Event Service verifica i token con la chiave pubblica corrispondente senza dover contattare l'Auth Service a ogni richiesta. La chiave pubblica può essere esposta dall'Auth Service tramite endpoint JWKS standard.

### Firma HMAC del Payload

Ogni payload inviato dal plugin è firmato con HMAC-SHA256 usando il signing secret di sessione. Questo garantisce che:

- il payload non sia stato alterato in transito
- il mittente sia effettivamente il plugin autenticato e non una fonte esterna

Il signing secret è legato alla sessione e ha lo stesso TTL del JWT. A ogni refresh viene rigenerato, limitando la finestra di esposizione in caso di compromissione.

### Secret Storage

Il signing secret non viene mai scritto su disco o su database relazionale. Vive esclusivamente in Redis con TTL. Alla scadenza il plugin deve fare un nuovo login o refresh per ottenerne uno nuovo.

---

## Flusso Dati

```
[Plugin]
  └── ogni minuto:
        1. raccoglie dati dalla pagina
        2. costruisce payload
        3. firma payload con HMAC (signing secret)
        4. POST /events con JWT + X-Signature header

[Event Service]
  └── riceve richiesta:
        1. JWT Middleware → verifica token → estrae user_id
        2. HMAC Middleware → recupera secret da Redis → verifica firma
        3. Handler → push payload in coda Redis

[Worker Go]
  └── ogni 10 secondi:
        1. svuota coda Redis
        2. scrive nodi e relazioni su Neo4j

[Auth Service]
  └── login:
        1. verifica credenziali su PostgreSQL
        2. genera JWT + signing secret
        3. salva signing secret su Redis con TTL
        4. restituisce JWT + signing secret al plugin
```

---

## Infrastruttura Locale

Tutti i servizi vengono orchestrati tramite Docker Compose:

- **PostgreSQL** — persistenza utenti Auth Service
- **Redis** — buffer eventi + storage signing secret
- **Neo4j** — database a grafo per nodi e relazioni

I due microservizi Go (Auth Service e Event Service) vengono eseguiti localmente o anch'essi containerizzati. Neo4j espone la UI browser su porta 7474 per ispezione visiva del grafo durante il testing.

---

## Considerazioni Future

- **HTTPS** — in locale tramite `mkcert` per proteggere il trasporto; prerequisito prima di qualsiasi deploy
- **Cifratura E2E** — cifratura del payload lato plugin con schema RSA+AES ibrido; da valutare come step successivo alla stabilizzazione dell'architettura base
- **Secret Rotation** — il signing secret viene rigenerato a ogni refresh JWT; valutare una rotazione proattiva anche senza refresh esplicito per sessioni molto lunghe
- **Rate Limiting** — aggiungere rate limiting per user_id sull'Event Service per prevenire abusi