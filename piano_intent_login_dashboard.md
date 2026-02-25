# Piano: Intent-Based Login + Cookie Sessione Dashboard

## Obiettivo

Rendere la **stessa pagina login** in grado di servire due flussi distinti:

1. **Flusso Plugin** — aperta dal plugin con `?source=plugin`, dopo il login invia JWT + HMAC al plugin via `chrome.runtime.sendMessage` e chiude il tab.
2. **Flusso Dashboard** — aperta direttamente dal browser, dopo il login imposta un cookie di sessione HttpOnly e reindirizza alla `/dashboard`.

---

## Fase 1: Auth Service (Go) — Cookie di Sessione

**File:** `auth-service/handlers/auth.go`

- Estrarre funzione `createWebSession(userID, c *fiber.Ctx) error` che:
  - Genera un `session_token` casuale (32 byte, UUID o hex)
  - Lo salva in Redis: `session:<session_token>` → `user_id`, con TTL 7 giorni
  - Lo imposta come cookie HttpOnly sul response: `Set-Cookie: session=TOKEN; HttpOnly; SameSite=Lax; Path=/`
- Chiamare `createWebSession` sia in `Login` (email/pass) che in `LinkedInCallback`

**File:** `auth-service/handlers/session.go` *(nuovo)*

- `GET /me` — middleware che legge il cookie `session`, verifica in Redis, ritorna `{ user_id, email, full_name, avatar_url }`
- `POST /logout-web` — cancella il cookie e la chiave Redis

**File:** `auth-service/main.go`

- Aggiungere le route `/me` e `/logout-web`
- Aggiornare CORS per accettare cookies (`AllowCredentials: true`, `AllowOrigins: "http://localhost:3000"`)

---

## Fase 2: LinkedIn OAuth — Passare `source` nel `state`

**File:** `auth-service/handlers/linkedin.go`

- `LinkedInInit`: legge `?source=` dalla query, lo include nel parametro `state` OAuth2 (JSON base64-encoded con anche un nonce anti-CSRF)
- `LinkedInCallback`: decodifica lo `state`, estrae `source`
  - Se `source=plugin` → redirect a `http://localhost:3000/auth/callback?token=X&secret=Y&source=plugin`
  - Altrimenti → redirect a `http://localhost:3000/auth/callback` (nessun token in URL, solo cookie)

---

## Fase 3: Next.js Web App — Biforcazione Post-Login

**File:** `web-app/src/app/page.tsx`

- Leggere `?source=` da `useSearchParams()`
- Passare `source=plugin` come query param al bottone "Accedi con LinkedIn": `href="/auth/linkedin/login?source=plugin"` (via Auth Service redirect)
- Dopo login email/password: se `source=plugin` → `sendToPlugin`, mostra messaggio di chiusura; altrimenti → `router.push('/dashboard')`

**File:** `web-app/src/app/auth/callback/page.tsx`

- Leggere `?source=` dai search params
- Se `source=plugin` → `chrome.runtime.sendMessage` (come ora) + auto-close
- Se assente → redirect a `/dashboard` (il cookie è già stato settato dal backend)

**File:** `web-app/src/app/dashboard/page.tsx` *(nuovo)*

- Chiama `GET http://localhost:4000/me` con `credentials: 'include'` per verificare la sessione
- Se non autenticato → redirect a `/`
- Se autenticato → mostra schermata dashboard base (homepage utente)

**File:** `web-app/src/app/dashboard/layout.tsx` *(nuovo)*

- Layout con navbar, link di logout, info profilo utente

---

## Fase 4: Plugin — Aggiornamento URL di Login

**File:** `linkedin-suggestor/popup.js`

- Aggiornare apertura tab login da:
  ```javascript
  chrome.tabs.create({ url: WEB_APP_URL });
  ```
  a:
  ```javascript
  chrome.tabs.create({ url: WEB_APP_URL + '?source=plugin' });
  ```

---

## Flusso Completo

```
[Plugin] click "Accedi"
  → apre localhost:3000?source=plugin
  → utente sceglie email/pass o LinkedIn
     ├─ LinkedIn → GET /auth/linkedin/login?source=plugin
     │             → state={"source":"plugin","nonce":"..."}
     │             → LinkedIn callback → Auth Service
     │             → genera JWT + HMAC + session cookie
     │             → redirect /auth/callback?token=...&secret=...&source=plugin
     └─ Email/Pass → POST /login
                   → genera JWT + HMAC + session cookie
                   → sendToPlugin(jwt, secret)
  → chrome.runtime.sendMessage → plugin sbloccato ✓
  → tab si chiude automaticamente

[Browser] visita localhost:3000 direttamente
  → nessun ?source
  → login email/pass o LinkedIn (stessa pagina)
  → Auth Service: genera session cookie (senza JWT/HMAC in URL)
  → redirect /dashboard
  → GET /me con cookie → utente autenticato ✓
```

---

## Note Importanti

- Il cookie di sessione deve avere `SameSite=Lax` e **non** `Strict`, altrimenti il redirect OAuth da LinkedIn non porta il cookie.
- Il JWT nel URL del callback è accettabile **solo in locale** — in produzione usare un one-time code a scadenza rapida (30 secondi) al posto di JWT e secret in chiaro nell'URL.
- Next.js deve chiamare `/me` con `credentials: 'include'` e l'Auth Service deve avere `AllowCredentials: true` nel CORS per consentire i cookie cross-origin.
