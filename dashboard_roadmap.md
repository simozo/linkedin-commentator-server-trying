# Dashboard — Idee e Roadmap

## Killer Feature: "Warm Reach Map" 🌉

### Il concetto

LinkedIn mostra i *2nd degree connections* basandosi su chi conosci **ufficialmente**.
Questo sistema può fare qualcosa di unico: trovare persone rilevanti basandosi su chi
interagisce con gli stessi contenuti — persone già engaged sul tuo tema, raggiungibili
attraverso un percorso di commenti che esiste **adesso**.

```
Tu ──[hai commentato]──> Post ──[anche commentato da]──> Bridge Person
                                                               │
                                           [ha commentato su] ↓
                                                          Target Person
                                     (non ti conosce, ma è già rilevante)
```

Non è una connessione fredda. È un percorso **caldo e documentato pubblicamente**.

---

## Componenti della Feature

Lo Step 1 è critico prima di tutto il resto: verificare che il plugin stia già raccogliendo i co-commenters di ogni post. Se quei nodi non esistono in Neo4j, il grafo non ha il materiale per trovare i percorsi bridge. 

### 1. Discovery Engine (Neo4j Cypher)

```cypher
// 2-hop: io → post → bridge person → post → target person
MATCH (me:User {id: $userId})-[:COMMENTED_ON]->(p:Post)
      <-[:COMMENTED_ON]-(bridge:Person)
      -[:COMMENTED_ON]->(p2:Post)
      <-[:COMMENTED_ON]-(target:Person)
WHERE NOT (me)-[:COMMENTED_ON]->()<-[:COMMENTED_ON]-(target)
  AND target <> bridge
RETURN target, bridge, p, p2,
       count(*) AS path_strength
ORDER BY path_strength DESC
LIMIT 20
```

Neo4j è nato per questo. Questa query in un DB relazionale sarebbe un problema; in Neo4j è un `MATCH` singolo.

### 2. Scoring dei Target

Pesatura per:
- **Rilevanza topica**: il target parla degli stessi temi tuoi?
- **Attività recente**: ha commentato nell'ultima settimana?
- **Forza del bridge**: quante interazioni condivise hai col bridge?
- **Potenziale reciprocità**: ha risposto ad altri commenti in quel thread?

### 3. Path Visualizer (D3.js / Cytoscape.js)

Grafo interattivo nella dashboard:
- **Nodi**: Tu, Bridge Person, Target Person, Post condivisi
- **Archi**: relazioni di interazione con peso = intensità
- **Click su target** → apre il pannello "Reach Action"

### 4. Action Generator (Claude)

Quando l'utente seleziona un Target:
> 🤖 "Per raggiungere **Laura Bianchi**, commenta il post *[titolo]* di Mario Rossi rispondendo direttamente al suo commento. Ecco un angolo efficace basato sul suo profilo..."

Claude genera il commento su misura tenendo conto di:
- Il profilo professionale del Target (dati dal grafo)
- Il contesto del post comune
- Il tono del commento del Bridge

### 5. Tracking & Follow-up

- Segna quale target hai "targetato" e quando
- Monitora se il Target risponde nei thread successivi
- Notifica (popup plugin) quando un Target commentato interagisce con te

---

## Architettura: Pattern CQRS con `dashboard-server`

L'**Event Service resta esclusivamente write-only** — riceve eventi dal plugin, batchizza scritture su Neo4j, non espone mai dati in lettura alla dashboard.

Un nuovo microservizio Go, `dashboard-server`, gestisce invece tutto il lato lettura e nel tempo farà anche altre operazioni (es. suggerimenti AI, trigger, notifiche).

```
┌────────────────┐   eventi    ┌──────────────────┐   write   ┌─────────┐
│  Plugin Chrome │────────────▶│  Event Service   │──────────▶│  Neo4j  │
└────────────────┘             │  :3000 (write)   │           └────┬────┘
                               └──────────────────┘                │ read
                                                                    ▼
┌────────────────┐  API calls  ┌──────────────────┐           ┌─────────┐
│  Next.js       │────────────▶│ dashboard-server  │──────────▶│  Neo4j  │
│  :3001         │             │  :5000 (read+ops) │           └─────────┘
└────────────────┘             └──────┬───────────┘
                                      │ session check
                               ┌──────▼───────────┐
                               │  Redis (shared)   │
                               │  Auth Service     │
                               └──────────────────┘
```

### Struttura `dashboard-server`

```
dashboard-server/
├── main.go                 ← Fiber, porta 5000, CORS per localhost:3001
├── database/
│   ├── neo4j.go            ← connessione Neo4j (read queries)
│   └── redis.go            ← validazione session cookie (Redis condiviso)
├── middleware/
│   └── session.go          ← legge cookie → GET session:<token> da Redis → user_id
├── handlers/
│   ├── stats.go            ← GET /api/stats
│   ├── activity.go         ← GET /api/activity
│   ├── bridge.go           ← GET /api/bridge-targets (Warm Reach Map)
│   ├── graph.go            ← GET /api/graph (payload per D3.js / Cytoscape)
│   └── ai.go               ← POST /api/generate-bridge-comment (chiama Claude)
└── .env
```

### Validazione sessione senza dipendere dall'Auth Service

Il `dashboard-server` legge direttamente da Redis (condiviso) — nessuna chiamata HTTP interna:

```go
// middleware/session.go
func AuthRequired(c *fiber.Ctx) error {
    token := c.Cookies("session")
    userID, err := redis.Get(ctx, "session:"+token).Result()
    if err != nil {
        return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
    }
    c.Locals("user_id", userID)
    return c.Next()
}
```

---

## Roadmap di Sviluppo

### Step 1 — Prerequisito: Arricchire i dati tracciati dal plugin

Verificare che il plugin salvi anche i **co-commenters** sui post, non solo l'autore.
Il Content Script deve estrarre anche le altre persone che commentano sullo stesso post.

**Dati necessari nel payload evento:**
```json
{
  "post_urn": "...",
  "post_author": { "name": "...", "profile_url": "..." },
  "co_commenters": [
    { "name": "...", "profile_url": "...", "comment_snippet": "..." }
  ]
}
```

### Step 2 — Creare il `dashboard-server` (Go/Fiber)

- Nuovo progetto Go in `dashboard-server/`
- Porta `:5000`
- Connessione Redis (condiviso con Auth Service) per validare session cookie
- Connessione Neo4j in sola lettura
- Middleware `AuthRequired` su tutte le route `/api/*`
- CORS configurato per `localhost:3001` (Next.js dashboard)

### Step 3 — Endpoint API di base

```
GET  /api/stats             → { posts_analyzed, comments, people, streak }
GET  /api/activity?limit=   → [ { post_urn, title, author, date, comment_text } ]
GET  /api/bridge-targets    → [ { target, bridge, shared_post, path_strength } ]
GET  /api/graph             → { nodes, edges } — per il path visualizer
POST /api/generate-comment  → Claude genera il commento bridge su misura
```

### Step 4 — Dashboard Overview (Activity)

Prima schermata del dashboard:
- Statistiche settimanali (post analizzati, commenti generati, persone raggiunte)
- Feed attività recente (lista ultimi post commentati)
- "Streak di utilizzo" — gamification leggera

### Step 5 — Warm Reach Map

La feature killer:
- Lista card dei target raggiungibili con path evidenziato
- Grafo interattivo browsable (D3.js o Cytoscape.js)
- Pulsante "Genera commento bridge" → POST /api/generate-comment → Claude

### Step 6 — Insights & Analytics

- Argomenti più commentati (tag cloud / bar chart)
- Scopi più usati nel plugin (Strategico vs. Professionale etc.)
- Ore e giorni di maggiore attività
- "Top Bridge People" — chi ti connette a più persone nuove

### Step 7 — Tracking & Follow-up (in dashboard-server)

- API per "marcare" un target come "in lavorazione"
- Monitor passivo: quando il plugin traccia un evento con quel target → aggiorna stato
- Notifica nel popup plugin quando un target entra in contatto con te

---

## Perché è davvero differenziante

| Feature | LinkedIn nativo | Warm Reach Map |
|---|---|---|
| 2nd degree connections | ✅ Basato su connessioni ufficiali | 🚀 Basato su interazioni reali |
| Contesti condivisi | ❌ Non disponibile | ✅ Post, temi, thread comuni |
| Azione suggerita | ❌ Solo "Connetti" | ✅ Commento specifico generato da AI |
| Dati raccolti | Su tutta LinkedIn | Solo i tuoi dati, privacy-first |
| Cold outreach | Sempre freddo | Sempre caldo (percorso documentato) |

Il grafo si auto-alimenta: più usi il plugin, più nodi e archi accumulano,
più la Warm Reach Map diventa precisa e potente. Dopo 3 mesi di utilizzo quotidiano,
è un asset competitivo impossibile da replicare.
