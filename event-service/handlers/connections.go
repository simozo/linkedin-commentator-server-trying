package handlers

import (
	"context"
	"fmt"
	"time"

	"event-service/database"

	"github.com/gofiber/fiber/v2"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// Connection rappresenta un singolo contatto LinkedIn importato dalla pagina Collegament.
type Connection struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Headline    string `json:"headline"`
	ConnectedAt string `json:"connected_at"` // "YYYY-MM-DD"
}

// ConnectionBatch è il payload del POST /connections/batch.
type ConnectionBatch struct {
	Connections []Connection `json:"connections"`
}

// ImportConnections gestisce POST /connections/batch.
// Scrive direttamente su Neo4j (no Redis queue — non serve bassa latenza).
// Autenticazione: JWT + HMAC (stessi middleware di /events/).
func ImportConnections(c *fiber.Ctx) error {
	var batch ConnectionBatch
	if err := c.BodyParser(&batch); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if len(batch.Connections) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "connections array is empty"})
	}
	if len(batch.Connections) > 200 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "max 200 connections per batch"})
	}

	// L'UserID è iniettato dal middleware JWT — mai fidarsi del payload
	userID := fmt.Sprintf("%.0f", c.Locals("user_id").(float64))

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{
		AccessMode: neo4j.AccessModeWrite,
	})
	defer session.Close(ctx)

	imported := 0
	skipped := 0

	for _, conn := range batch.Connections {
		if conn.Slug == "" {
			skipped++
			continue
		}

		_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
			_, err := tx.Run(ctx, `
				MERGE (p:Person {slug: $slug})
				ON CREATE SET p.name = $name, p.headline = $headline, p.created_at = datetime()
				ON MATCH  SET p.name = $name, p.headline = $headline
				WITH p
				MATCH (u:User {id: $userId})
				MERGE (u)-[r:CONNECTED_TO]->(p)
				ON CREATE SET r.since = $since, r.updated_at = datetime()
			`, map[string]any{
				"slug":     conn.Slug,
				"name":     conn.Name,
				"headline": conn.Headline,
				"userId":   userID,
				"since":    conn.ConnectedAt,
			})
			return nil, err
		})

		if err != nil {
			skipped++
		} else {
			imported++
		}
	}

	return c.JSON(fiber.Map{
		"imported": imported,
		"skipped":  skipped,
	})
}
