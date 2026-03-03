package worker

import (
	"context"
	"log"
	"time"

	"event-service/database"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// StartWeighting starts the periodic background worker for relationship weighting
func StartWeighting() {
	// Periodic execution every 60 seconds
	ticker := time.NewTicker(60 * time.Second)
	log.Println("[WeightWorker] started - periodic weighting every 60s")

	for range ticker.C {
		runWeighting()
	}
}

func runWeighting() {
	ctx := context.Background()

	// Optimization: check if graph is "dirty" (new events flushed since last run)
	isDirty, err := database.RedisClient.Exists(ctx, "graph:dirty").Result()
	if err != nil || isDirty == 0 {
		// Log only at higher log levels in production, here we skip silently or with trace
		return
	}

	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	log.Println("[WeightWorker] Graph is dirty. Running algorithmic weighting cycle...")

	// Phase A: Algorithmic Weighting
	// We update the 'weight' property on relationships based on their type.
	// This is the structural foundation for the Warm Reach Map.
	_, err = session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `
		MATCH (p)-[r:COMMENTED_ON|MENTIONS|AMPLIFIED|AUTHORED_BY]->(post:Post)
		WITH r,
		     CASE type(r) 
		       WHEN 'MENTIONS' THEN 10 
		       WHEN 'COMMENTED_ON' THEN 5 
		       WHEN 'AUTHORED_BY' THEN 8
		       WHEN 'AMPLIFIED' THEN 2 
		       ELSE 1 
		     END AS base_weight
		SET r.weight = base_weight
		RETURN count(r) as updatedCount
		`
		res, err := tx.Run(ctx, query, nil)
		if err != nil {
			return nil, err
		}

		if res.Next(ctx) {
			count, _ := res.Record().Get("updatedCount")
			log.Printf("[WeightWorker] Phase A complete: updated %v relationships\n", count)
		}

		return nil, nil
	})

	if err != nil {
		log.Printf("[WeightWorker] Error during weighting: %v\n", err)
	} else {
		// Reset flag
		database.RedisClient.Del(ctx, "graph:dirty")
	}
}
