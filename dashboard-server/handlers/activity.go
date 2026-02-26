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

type ActivityItem struct {
	PostUrn    string `json:"post_urn"`
	PostURL    string `json:"post_url"`
	AuthorName string `json:"author_name"`
	AuthorSlug string `json:"author_slug"`
	Action     string `json:"action"`
	PostText   string `json:"post_text"`
	Timestamp  string `json:"timestamp"`
}

// GetActivity handles GET /api/activity?limit=20&offset=0
// Returns the most recent activity events for the authenticated user.
func GetActivity(c *fiber.Ctx) error {
	userID := fmt.Sprint(c.Locals("user_id"))
	limit := c.QueryInt("limit", 20)
	offset := c.QueryInt("offset", 0)
	start := time.Now()

	ctx := context.Background()
	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `
		MATCH (u:User {id: $userId})-[a:ACTION]->(p:Post)
		OPTIONAL MATCH (p)-[:AUTHORED_BY]->(author:Person)
		RETURN
		  p.urn       AS post_urn,
		  p.url       AS post_url,
		  author.name AS author_name,
		  author.slug AS author_slug,
		  a.type      AS action,
		  p.text      AS post_text,
		  a.timestamp AS timestamp
		ORDER BY a.timestamp DESC
		SKIP $offset
		LIMIT $limit
		`
		records, err := tx.Run(ctx, query, map[string]any{
			"userId": userID,
			"limit":  limit,
			"offset": offset,
		})
		if err != nil {
			return nil, err
		}

		var items []ActivityItem
		for records.Next(ctx) {
			r := records.Record()
			str := func(key string) string {
				v, _ := r.Get(key)
				if v == nil {
					return ""
				}
				return fmt.Sprint(v)
			}
			items = append(items, ActivityItem{
				PostUrn:    str("post_urn"),
				PostURL:    str("post_url"),
				AuthorName: str("author_name"),
				AuthorSlug: str("author_slug"),
				Action:     str("action"),
				PostText:   str("post_text"),
				Timestamp:  str("timestamp"),
			})
		}
		if items == nil {
			items = []ActivityItem{}
		}
		return items, nil
	})

	if err != nil {
		logger.Error("activity query failed", "err", err, "user_id", userID, "limit", limit, "offset", offset)
		return c.Status(500).JSON(fiber.Map{"error": "Neo4j query failed: " + err.Error()})
	}

	items := result.([]ActivityItem)
	logger.Info("activity served", "user_id", userID, "count", len(items), "duration_ms", time.Since(start).Milliseconds())
	return c.JSON(result)
}
