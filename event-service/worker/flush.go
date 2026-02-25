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
	UserID          string    `json:"user_id"`
	PostUrn         string    `json:"post_urn"`
	URL             string    `json:"url"`
	Action          string    `json:"action"`
	AuthorName      string    `json:"author_name"`
	AuthorSlug      string    `json:"author_slug"`
	AuthorDegree    string    `json:"author_degree"`
	PostText        string    `json:"post_text"`
	InteractionType string    `json:"interaction_type"`
	InteractorName  string    `json:"interactor_name"`
	InteractorSlug  string    `json:"interactor_slug"`
	Timestamp       time.Time `json:"timestamp"`
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
			MERGE (a:Person {slug: $authorSlug})
			  ON CREATE SET a.name = $authorName, a.degree = $authorDegree
			  ON MATCH SET a.name = $authorName, a.degree = coalesce($authorDegree, a.degree)
			  
			MERGE (p:Post {urn: $postUrn})
			  ON CREATE SET p.text = $postText, p.url = $url
			  
			MERGE (p)-[:AUTHORED_BY]->(a)
			
			MERGE (u:User {id: $userId})
			CREATE (u)-[:ACTION {type: $action, timestamp: $timestamp}]->(p)
			`

			params := map[string]any{
				"userId":       e.UserID,
				"postUrn":      e.PostUrn,
				"url":          e.URL,
				"action":       e.Action,
				"authorName":   e.AuthorName,
				"authorSlug":   e.AuthorSlug,
				"authorDegree": e.AuthorDegree,
				"postText":     e.PostText,
				"timestamp":    e.Timestamp.Format(time.RFC3339),
			}

			if e.InteractorSlug != "" {
				query += `
				MERGE (i:Person {slug: $interactorSlug})
				  ON CREATE SET i.name = $interactorName
				  ON MATCH SET i.name = $interactorName
				  
				MERGE (i)-[:AMPLIFIED {type: $interactionType}]->(p)
				`
				params["interactorSlug"] = e.InteractorSlug
				params["interactorName"] = e.InteractorName
				params["interactionType"] = e.InteractionType
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
