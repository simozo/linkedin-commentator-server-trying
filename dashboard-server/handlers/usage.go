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

type UsageResponse struct {
	Tier             string  `json:"tier"`
	CommentsToday    int64   `json:"comments_today"`
	DailyLimit       int64   `json:"daily_limit"`
	GraphMaturity    float64 `json:"graph_maturity"` // 0.0 to 1.0
	NodesCount       int64   `json:"nodes_count"`
	TargetNodesCount int64   `json:"target_nodes_count"`
	IsLimitReached   bool    `json:"is_limit_reached"`
}

const (
	FreeDailyLimit   = 5
	ProDailyLimit    = 9999
	GraphTargetNodes = 500 // Threshold for a "mature" graph
)

// GetUsage handles GET /api/user/usage
func GetUsage(c *fiber.Ctx) error {
	userID := fmt.Sprint(c.Locals("user_id"))
	// In a real scenario, tier would come from the session/JWT or a DB call.
	// Since dashboard-server doesn't have the User PG model, we can extract it from locals
	// assuming the AuthRequired middleware was updated or we fetch it here.
	tier := "free"
	if t, ok := c.Locals("tier").(string); ok {
		tier = t
	}

	start := time.Now()
	ctx := context.Background()
	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		// 1. Count comments generated today
		// 2. Count total Person nodes discovered (as a proxy for graph maturity)
		query := `
		MATCH (u:User {id: $userId})
		OPTIONAL MATCH (u)-[a:ACTION]->(p:Post)
		WHERE a.type = 'comment_generated' AND date(datetime(a.timestamp)) = date()
		WITH count(a) AS comments_today
		
		MATCH (p:Person)
		RETURN comments_today, count(p) AS nodes_count
		`
		rec, err := tx.Run(ctx, query, map[string]any{"userId": userID})
		if err != nil {
			return nil, err
		}

		if rec.Next(ctx) {
			r := rec.Record()
			commentsToday, _ := r.Get("comments_today")
			nodesCount, _ := r.Get("nodes_count")

			return map[string]int64{
				"comments_today": commentsToday.(int64),
				"nodes_count":    nodesCount.(int64),
			}, nil
		}
		return map[string]int64{"comments_today": 0, "nodes_count": 0}, nil
	})

	if err != nil {
		logger.Error("usage query failed", "err", err, "user_id", userID)
		return c.Status(500).JSON(fiber.Map{"error": "Neo4j query failed"})
	}

	stats := result.(map[string]int64)
	limit := int64(FreeDailyLimit)
	if tier == "pro" || tier == "growth" || tier == "scale" {
		limit = ProDailyLimit
	}

	maturity := float64(stats["nodes_count"]) / float64(GraphTargetNodes)
	if maturity > 1.0 {
		maturity = 1.0
	}

	usage := UsageResponse{
		Tier:             tier,
		CommentsToday:    stats["comments_today"],
		DailyLimit:       limit,
		GraphMaturity:    maturity,
		NodesCount:       stats["nodes_count"],
		TargetNodesCount: GraphTargetNodes,
		IsLimitReached:   tier == "free" && stats["comments_today"] >= int64(FreeDailyLimit),
	}

	logger.Info("usage served", "user_id", userID, "tier", tier, "duration_ms", time.Since(start).Milliseconds())
	return c.JSON(usage)
}
