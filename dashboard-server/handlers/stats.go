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
