package handlers

import (
	"context"
	"fmt"
	"time"

	"dashboard-server/database"

	"github.com/gofiber/fiber/v2"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

type RelevantPost struct {
	URN        string `json:"post_urn"`
	URL        string `json:"post_url"`
	Text       string `json:"post_text"`
	AuthorName string `json:"author_name"`
	AuthorSlug string `json:"author_slug"`
	Timestamp  string `json:"timestamp"`
}

// GetRelevantPosts handles GET /api/posts/relevant
// Returns up to 3 posts viewed by the user in the last 24 hours.
func GetRelevantPosts(c *fiber.Ctx) error {
	userID := fmt.Sprint(c.Locals("user_id"))
	ctx := context.Background()
	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	cutoff := time.Now().UTC().Add(-24 * time.Hour).Format(time.RFC3339)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		rec, err := tx.Run(ctx, `
			MATCH (u:User {id: $userId})-[a:ACTION {type: "post_viewed"}]->(p:Post)-[:AUTHORED_BY]->(author:Person)
			WHERE a.timestamp > $cutoff
			RETURN
				p.urn       AS urn,
				p.url       AS url,
				p.text      AS text,
				author.name AS author_name,
				author.slug AS author_slug,
				a.timestamp AS ts
			ORDER BY a.timestamp DESC
			LIMIT 3
		`, map[string]any{"userId": userID, "cutoff": cutoff})
		if err != nil {
			return nil, err
		}

		posts := []RelevantPost{}
		for rec.Next(ctx) {
			r := rec.Record()
			str := func(key string) string {
				v, _ := r.Get(key)
				if v == nil {
					return ""
				}
				return fmt.Sprint(v)
			}
			posts = append(posts, RelevantPost{
				URN:        str("urn"),
				URL:        str("url"),
				Text:       str("text"),
				AuthorName: str("author_name"),
				AuthorSlug: str("author_slug"),
				Timestamp:  str("ts"),
			})
		}
		return posts, nil
	})

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}
