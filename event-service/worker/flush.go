package worker

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"event-service/database"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// Event is identical to the one in handlers (you might want to put this in a shared definitions package later)
type Event struct {
	UserID    string    `json:"user_id"`
	URL       string    `json:"url"`
	Title     string    `json:"title"`
	Action    string    `json:"action"`
	CreatedAt time.Time `json:"created_at"`
}

func StartFlush() {
	ticker := time.NewTicker(10 * time.Second)
	for range ticker.C {
		flush()
	}
}

func flush() {
	// Pop everything inside events_queue
	ctx := context.Background()
	results, err := database.RedisClient.LRange(ctx, "events_queue", 0, -1).Result()
	if err != nil || len(results) == 0 {
		return
	}

	// Clear queue atomically
	database.RedisClient.Del(ctx, "events_queue")

	// Prepare data batch
	var eventsToProcess []Event
	for _, raw := range results {
		var event Event
		if err := json.Unmarshal([]byte(raw), &event); err == nil {
			eventsToProcess = append(eventsToProcess, event)
		}
	}

	if len(eventsToProcess) > 0 {
		writeToNeo4j(eventsToProcess)
	}
}

func writeToNeo4j(events []Event) {
	ctx := context.Background()
	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		for _, e := range events {
			query := `
			MERGE (u:User {id: $userId})
			MERGE (p:Page {url: $url, title: $title})
			MERGE (u)-[:VISITED {action: $action, timestamp: $timestamp}]->(p)
			`
			params := map[string]any{
				"userId":    e.UserID,
				"url":       e.URL,
				"title":     e.Title,
				"action":    e.Action,
				"timestamp": e.CreatedAt.Unix(),
			}
			if _, err := tx.Run(ctx, query, params); err != nil {
				log.Printf("Failed to write to neo4j: %v\n", err)
			}
		}
		return nil, nil
	})

	if err != nil {
		log.Printf("Transaction execution failed: %v\n", err)
	} else {
		log.Printf("Successfully flushed %d events to Neo4j\n", len(events))
	}
}
