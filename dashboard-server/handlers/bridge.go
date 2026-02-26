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

type BridgeTarget struct {
	TargetName   string `json:"target_name"`
	TargetSlug   string `json:"target_slug"`
	BridgeName   string `json:"bridge_name"`
	BridgeSlug   string `json:"bridge_slug"`
	SharedPost   string `json:"shared_post_urn"`
	PostText     string `json:"post_text"`
	PathStrength int64  `json:"path_strength"`
}

// GetBridgeTargets handles GET /api/bridge-targets
// Core query for the Warm Reach Map: finds people reachable via a 2-hop
// co-commenter path through posts the user has interacted with.
func GetBridgeTargets(c *fiber.Ctx) error {
	userID := fmt.Sprint(c.Locals("user_id"))
	start := time.Now()

	ctx := context.Background()
	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		// 2-hop bridge traversal:
		// Me → (ACTION on) → Post ← (COMMENTED_ON) ← Bridge Person
		//                            ↓ (COMMENTED_ON)
		//                          Post2 ← (COMMENTED_ON) ← Target Person
		// Target = person I haven't directly reached yet
		query := `
		MATCH (me:User {id: $userId})-[:ACTION]->(p:Post)
		      <-[:COMMENTED_ON]-(bridge:Person)
		      -[:COMMENTED_ON]->(p2:Post)
		      <-[:COMMENTED_ON]-(target:Person)
		WHERE NOT (me)-[:ACTION]->(:Post)<-[:COMMENTED_ON]-(target)
		  AND target.slug <> bridge.slug
		  AND target.slug IS NOT NULL
		  AND bridge.slug IS NOT NULL
		RETURN
		  target.name   AS target_name,
		  target.slug   AS target_slug,
		  bridge.name   AS bridge_name,
		  bridge.slug   AS bridge_slug,
		  p2.urn        AS shared_post_urn,
		  p2.text       AS post_text,
		  count(*)      AS path_strength
		ORDER BY path_strength DESC
		LIMIT 20
		`
		records, err := tx.Run(ctx, query, map[string]any{"userId": userID})
		if err != nil {
			return nil, err
		}

		var targets []BridgeTarget
		for records.Next(ctx) {
			r := records.Record()
			str := func(key string) string {
				v, _ := r.Get(key)
				if v == nil {
					return ""
				}
				return fmt.Sprint(v)
			}
			int64val := func(key string) int64 {
				v, _ := r.Get(key)
				if v == nil {
					return 0
				}
				return v.(int64)
			}
			targets = append(targets, BridgeTarget{
				TargetName:   str("target_name"),
				TargetSlug:   str("target_slug"),
				BridgeName:   str("bridge_name"),
				BridgeSlug:   str("bridge_slug"),
				SharedPost:   str("shared_post_urn"),
				PostText:     str("post_text"),
				PathStrength: int64val("path_strength"),
			})
		}
		if targets == nil {
			targets = []BridgeTarget{}
		}
		return targets, nil
	})

	if err != nil {
		logger.Error("bridge-targets query failed", "err", err, "user_id", userID)
		return c.Status(500).JSON(fiber.Map{"error": "Neo4j query failed: " + err.Error()})
	}

	targets := result.([]BridgeTarget)
	logger.Info("bridge-targets served", "user_id", userID, "count", len(targets), "duration_ms", time.Since(start).Milliseconds())
	return c.JSON(result)
}
