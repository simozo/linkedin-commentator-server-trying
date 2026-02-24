step-by-step per testare l'architettura in locale.

## Step 1 — Ambiente locale con Docker Compose

Prima cosa, alzi tutto con un solo comando. Crea un `docker-compose.yml`:

```yaml
services:
  neo4j:
    image: neo4j:5
    ports:
      - "7474:7474"  # browser UI
      - "7687:7687"  # bolt protocol
    environment:
      NEO4J_AUTH: neo4j/password123
    volumes:
      - neo4j_data:/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  neo4j_data:
```

```bash
docker-compose up -d
```

Neo4j UI disponibile su `http://localhost:7474`

---

## Step 2 — Struttura del progetto Go

```
/backend
  main.go
  /handlers
    events.go
  /worker
    flush.go
  /db
    neo4j.go
    redis.go
  docker-compose.yml
```

---

## Step 3 — Backend Go (Fiber)

**main.go** — avvia server + worker

```go
package main

import (
    "github.com/gofiber/fiber/v2"
    "github.com/gofiber/fiber/v2/middleware/cors"
    "backend/handlers"
    "backend/worker"
)

func main() {
    app := fiber.New()
    app.Use(cors.New()) // permetti chiamate dal plugin

    app.Post("/events", handlers.ReceiveEvent)

    go worker.StartFlush() // goroutine che svuota Redis -> Neo4j

    app.Listen(":3000")
}
```

**handlers/events.go** — riceve i dati dal plugin e li mette in Redis

```go
type Event struct {
    UserID  string `json:"user_id"`
    URL     string `json:"url"`
    Title   string `json:"title"`
    Action  string `json:"action"` // "visit", "content", ecc.
}

func ReceiveEvent(c *fiber.Ctx) error {
    event := new(Event)
    if err := c.BodyParser(event); err != nil {
        return c.Status(400).JSON(fiber.Map{"error": err.Error()})
    }
    
    // serializza e pusha in Redis
    data, _ := json.Marshal(event)
    rdb.LPush(ctx, "events_queue", data)
    
    return c.JSON(fiber.Map{"status": "ok"})
}
```

**worker/flush.go** — ogni 10 secondi svuota Redis e scrive su Neo4j

```go
func StartFlush() {
    ticker := time.NewTicker(10 * time.Second)
    for range ticker.C {
        flush()
    }
}

func flush() {
    // prendi tutti gli eventi dalla coda Redis
    results, _ := rdb.LRange(ctx, "events_queue", 0, -1).Result()
    if len(results) == 0 return

    rdb.Del(ctx, "events_queue")

    for _, raw := range results {
        var event Event
        json.Unmarshal([]byte(raw), &event)
        writeToNeo4j(event)
    }
}
```

**db/neo4j.go** — query Cypher per creare nodi e relazioni

```go
func writeToNeo4j(event Event) {
    session := driver.NewSession(ctx, neo4j.SessionConfig{})
    defer session.Close(ctx)

    session.Run(ctx, `
        MERGE (u:User {id: $userId})
        MERGE (p:Page {url: $url, title: $title})
        MERGE (u)-[:VISITED {timestamp: timestamp()}]->(p)
    `, map[string]any{
        "userId": event.UserID,
        "url":    event.URL,
        "title":  event.Title,
    })
}
```

---

## Step 4 — Chiamata dal plugin

Nel tuo plugin aggiungi la chiamata POST:

```js
async function sendEvent(data) {
    await fetch("http://localhost:3000/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: "test-user-1", // hardcoded per ora
            url: window.location.href,
            title: document.title,
            action: "visit"
        })
    });
}
```

---

## Step 5 — Verifica

Una volta che tutto gira, verifica su Neo4j Browser (`localhost:7474`):

```cypher
MATCH (u:User)-[r:VISITED]->(p:Page)
RETURN u, r, p
```

Dovresti vedere il grafo popolarsi in tempo reale.

---

## Ordine di esecuzione

1. `docker-compose up -d`
2. `go mod init backend && go mod tidy`
3. `go run main.go`
4. Carica il plugin nel browser
5. Naviga su qualche pagina
6. Controlla Neo4j UI dopo ~10 secondi

Vuoi che generi i file completi pronti da usare?