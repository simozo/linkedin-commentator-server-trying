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

type TrendPost struct {
	URN          string `json:"urn"`
	Text         string `json:"text"`
	AuthorName   string `json:"authorName"`
	AuthorAvatar string `json:"authorAvatar"`
	AuthorSlug   string `json:"authorSlug"`
}

type TrendMention struct {
	Name   string `json:"name"`
	Avatar string `json:"avatar"`
	Slug   string `json:"slug"`
	Type   string `json:"type"` // "mention", "liked", "reposted", etc.
}

type TrendItem struct {
	Name     string         `json:"name"`
	Count    int64          `json:"count"`
	Posts    []TrendPost    `json:"posts"`
	Mentions []TrendMention `json:"mentions"`
}

// GetTrends handles GET /api/trends
func GetTrends(c *fiber.Ctx) error {
	userID := fmt.Sprint(c.Locals("user_id"))
	start := time.Now()

	ctx := context.Background()
	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `
		MATCH (u:User {id: $userId})-[a:ACTION]->(p:Post)-[:HAS_TOPIC]->(t:Topic)
		WITH t, count(p) AS trendCount
		ORDER BY trendCount DESC
		LIMIT 50
		MATCH (p:Post)-[:HAS_TOPIC]->(t)
		MATCH (p)-[:AUTHORED_BY]->(auth)
		OPTIONAL MATCH (p)-[relM:MENTIONS]->(m)
		OPTIONAL MATCH (inter)-[relA:AMPLIFIED]->(p)
		WITH t, trendCount, p, auth, m, relM, inter, relA
		ORDER BY p.timestamp DESC
		WITH t, trendCount, 
		     collect(DISTINCT {
		         urn: p.urn, 
		         text: p.text, 
		         authorName: auth.name, 
		         authorAvatar: auth.avatar_url, 
		         authorSlug: auth.slug
		     })[..3] AS posts,
		     collect(DISTINCT {
		         name: coalesce(m.name, inter.name),
		         avatar: coalesce(m.avatar_url, inter.avatar_url),
		         slug: coalesce(m.slug, inter.slug),
		         type: CASE 
		             WHEN m IS NOT NULL THEN 'mention'
		             WHEN inter IS NOT NULL THEN relA.type
		             ELSE 'unknown'
		         END
		     })[..15] AS mentions
		RETURN t.name AS name, trendCount AS count, posts, mentions
		ORDER BY count DESC
		`
		rec, err := tx.Run(ctx, query, map[string]any{"userId": userID})
		if err != nil {
			return nil, err
		}

		var trends []TrendItem
		for rec.Next(ctx) {
			r := rec.Record()
			name, _ := r.Get("name")
			count, _ := r.Get("count")
			postsRaw, _ := r.Get("posts")
			mentionsRaw, _ := r.Get("mentions")

			posts := []TrendPost{}
			if postsRaw != nil {
				for _, p := range postsRaw.([]any) {
					pMap := p.(map[string]any)
					// Safe property extraction
					post := TrendPost{}
					if v, ok := pMap["urn"].(string); ok {
						post.URN = v
					}
					if v, ok := pMap["text"].(string); ok {
						post.Text = v
					}
					if v, ok := pMap["authorName"].(string); ok {
						post.AuthorName = v
					}
					if v, ok := pMap["authorAvatar"].(string); ok {
						post.AuthorAvatar = v
					}
					if v, ok := pMap["authorSlug"].(string); ok {
						post.AuthorSlug = v
					}

					if post.URN != "" {
						posts = append(posts, post)
					}
				}
			}

			mentions := []TrendMention{}
			if mentionsRaw != nil {
				for _, m := range mentionsRaw.([]any) {
					mMap := m.(map[string]any)
					if mMap["name"] == nil {
						continue
					}
					mention := TrendMention{}
					if v, ok := mMap["name"].(string); ok {
						mention.Name = v
					}
					if v, ok := mMap["avatar"].(string); ok {
						mention.Avatar = v
					}
					if v, ok := mMap["slug"].(string); ok {
						mention.Slug = v
					}
					if v, ok := mMap["type"].(string); ok {
						mention.Type = v
					}

					if mention.Name != "" {
						mentions = append(mentions, mention)
					}
				}
			}

			trends = append(trends, TrendItem{
				Name:     name.(string),
				Count:    count.(int64),
				Posts:    posts,
				Mentions: mentions,
			})
		}

		if trends == nil {
			trends = []TrendItem{}
		}

		return trends, nil
	})

	if err != nil {
		logger.Error("trends query failed", "err", err, "user_id", userID)
		return c.Status(500).JSON(fiber.Map{"error": "Neo4j query failed: " + err.Error()})
	}

	logger.Info("trends served", "user_id", userID, "item_count", len(result.([]TrendItem)), "duration_ms", time.Since(start).Milliseconds())
	return c.JSON(result)
}
