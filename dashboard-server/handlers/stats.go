package handlers

import (
	"context"
	"fmt"
	"time"

	"dashboard-server/database"
	"dashboard-server/logger"

	"github.com/gofiber/fiber/v2"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

type StatsResponse struct {
	PostsAnalyzed int64 `json:"posts_analyzed"`
	CommentsGen   int64 `json:"comments_generated"`
	PeopleReached int64 `json:"people_reached"`
	UsageDays     int64 `json:"usage_days"`
	Connections   int64 `json:"connections"`
}

type MaturityResponse struct {
	ActionCount int64   `json:"action_count"`
	Level       string  `json:"level"`
	NextLevel   int64   `json:"next_level_threshold"`
	Progress    float64 `json:"progress"`
	Description string  `json:"description"`
}

// GetStats handles GET /api/stats
// Returns activity counters for the authenticated user.
func GetStats(c *fiber.Ctx) error {
	userID := fmt.Sprint(c.Locals("user_id"))
	start := time.Now()

	ctx := context.Background()
	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `
		MATCH (u:User {id: $userId})-[a:ACTION]->(p:Post)
		OPTIONAL MATCH (p)-[:AUTHORED_BY]->(author:Person)
		OPTIONAL MATCH (u)-[:CONNECTED_TO]->(p2:Person)
		RETURN
		  count(DISTINCT p)                                                    AS posts_analyzed,
		  count(DISTINCT CASE WHEN a.type = 'comment_generated' THEN p END)   AS comments_generated,
		  count(DISTINCT author)                                               AS people_reached,
		  count(DISTINCT date(datetime(a.timestamp)))                          AS usage_days,
		  count(DISTINCT p2)                                                   AS connections
		`
		rec, err := tx.Run(ctx, query, map[string]any{"userId": userID})
		if err != nil {
			return nil, err
		}
		if rec.Next(ctx) {
			r := rec.Record()
			get := func(key string) int64 {
				v, _ := r.Get(key)
				if v == nil {
					return 0
				}
				return v.(int64)
			}
			return StatsResponse{
				PostsAnalyzed: get("posts_analyzed"),
				CommentsGen:   get("comments_generated"),
				PeopleReached: get("people_reached"),
				UsageDays:     get("usage_days"),
				Connections:   get("connections"),
			}, nil
		}
		return StatsResponse{}, nil
	})

	if err != nil {
		logger.Error("stats query failed", "err", err, "user_id", userID)
		return c.Status(500).JSON(fiber.Map{"error": "Neo4j query failed: " + err.Error()})
	}

	logger.Info("stats served", "user_id", userID, "duration_ms", time.Since(start).Milliseconds())
	return c.JSON(result)
}

// GetMaturity handles GET /api/stats/maturity
func GetMaturity(c *fiber.Ctx) error {
	userID := fmt.Sprint(c.Locals("user_id"))
	ctx := context.Background()
	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.Run(ctx, "MATCH (:User {id: $userId})-[a:ACTION]->() RETURN count(a) as total", map[string]any{"userId": userID})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	var count int64
	if result.Next(ctx) {
		val, _ := result.Record().Get("total")
		if v, ok := val.(int64); ok {
			count = v
		}
	}

	maturity := MaturityResponse{
		ActionCount: count,
	}

	// Logic for levels
	switch {
	case count < 50:
		maturity.Level = "Seed"
		maturity.NextLevel = 50
		maturity.Description = "Raccogliendo i primi dati dal tuo feed..."
		maturity.Progress = (float64(count) / 50.0) * 100
	case count < 200:
		maturity.Level = "Sprout"
		maturity.NextLevel = 200
		maturity.Description = "Inizio a capire i tuoi interessi e chi segui."
		maturity.Progress = (float64(count-50) / 150.0) * 100
	case count < 500:
		maturity.Level = "Growth"
		maturity.NextLevel = 500
		maturity.Description = "Pronto per suggerimenti e commenti strategici."
		maturity.Progress = (float64(count-200) / 300.0) * 100
	default:
		maturity.Level = "Mature"
		maturity.NextLevel = 1000 // Future expansion
		maturity.Description = "Grafo completo. AI Bridge sbloccato!"
		maturity.Progress = 100
	}

	return c.JSON(maturity)
}
