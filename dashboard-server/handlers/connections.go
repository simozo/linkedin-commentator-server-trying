package handlers

import (
	"context"
	"fmt"
	"strconv"

	"dashboard-server/database"
	"dashboard-server/logger"

	"github.com/gofiber/fiber/v2"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

type ConnectionListItem struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Headline    string `json:"headline"`
	ConnectedAt string `json:"connected_at"`
}

type InsightItem struct {
	Role  string `json:"role"`
	Count int64  `json:"count"`
}

// GetConnectionsStats handles GET /api/connections/stats
func GetConnectionsStats(c *fiber.Ctx) error {
	userID := fmt.Sprint(c.Locals("user_id"))
	ctx := context.Background()
	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `
		MATCH (u:User {id: $userId})-[r:CONNECTED_TO]->(p:Person)
		RETURN count(p) AS total
		`
		rec, err := tx.Run(ctx, query, map[string]any{"userId": userID})
		if err != nil {
			return nil, err
		}
		if rec.Next(ctx) {
			v, _ := rec.Record().Get("total")
			return v.(int64), nil
		}
		return int64(0), nil
	})

	if err != nil {
		logger.Error("connections stats query failed", "err", err, "user_id", userID)
		return c.Status(500).JSON(fiber.Map{"error": "Query failed"})
	}

	return c.JSON(fiber.Map{"total": result})
}

// GetConnectionsList handles GET /api/connections/list
func GetConnectionsList(c *fiber.Ctx) error {
	userID := fmt.Sprint(c.Locals("user_id"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))

	ctx := context.Background()
	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `
		MATCH (u:User {id: $userId})-[r:CONNECTED_TO]->(p:Person)
		RETURN p.name AS name, p.slug AS slug, p.headline AS headline, r.since AS connected_at
		ORDER BY connected_at DESC
		SKIP $offset
		LIMIT $limit
		`
		rec, err := tx.Run(ctx, query, map[string]any{
			"userId": userID,
			"offset": offset,
			"limit":  limit,
		})
		if err != nil {
			return nil, err
		}

		var list []ConnectionListItem
		for rec.Next(ctx) {
			r := rec.Record()
			name, _ := r.Get("name")
			slug, _ := r.Get("slug")
			headline, _ := r.Get("headline")
			since, _ := r.Get("connected_at")

			list = append(list, ConnectionListItem{
				Name:        fmt.Sprint(name),
				Slug:        fmt.Sprint(slug),
				Headline:    fmt.Sprint(headline),
				ConnectedAt: fmt.Sprint(since),
			})
		}
		return list, nil
	})

	if err != nil {
		logger.Error("connections list query failed", "err", err, "user_id", userID)
		return c.Status(500).JSON(fiber.Map{"error": "Query failed"})
	}

	return c.JSON(result)
}

// GetNetworkInsights handles GET /api/connections/insights
func GetNetworkInsights(c *fiber.Ctx) error {
	userID := fmt.Sprint(c.Locals("user_id"))
	ctx := context.Background()
	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `
		MATCH (u:User {id: $userId})-[:CONNECTED_TO]->(p:Person)
		UNWIND ["CEO", "Founder", "CTO", "CPO", "Product", "Head of", "Manager", "Engineer", "Developer", "AI", "Startup", "Recruiter", "Investor"] AS role
		WITH p, role
		WHERE toLower(p.headline) CONTAINS toLower(role)
		RETURN role, count(*) AS count
		ORDER BY count DESC
		`
		rec, err := tx.Run(ctx, query, map[string]any{"userId": userID})
		if err != nil {
			return nil, err
		}

		var insights []InsightItem
		for rec.Next(ctx) {
			r := rec.Record()
			role, _ := r.Get("role")
			count, _ := r.Get("count")
			insights = append(insights, InsightItem{
				Role:  fmt.Sprint(role),
				Count: count.(int64),
			})
		}
		return insights, nil
	})

	if err != nil {
		logger.Error("network insights query failed", "err", err, "user_id", userID)
		return c.Status(500).JSON(fiber.Map{"error": "Query failed"})
	}

	return c.JSON(result)
}

type OverlapItem struct {
	Name         string `json:"name"`
	Slug         string `json:"slug"`
	OverlapCount int64  `json:"overlap_count"`
}

// GetNetworkOverlap handles GET /api/connections/overlap
func GetNetworkOverlap(c *fiber.Ctx) error {
	userID := fmt.Sprint(c.Locals("user_id"))
	ctx := context.Background()
	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `
		MATCH (u:User {id: $userId})-[:ACTION]->(p:Post)<-[:COMMENTED_ON]-(peer:Person)
		WHERE peer.slug <> $userId
		RETURN peer.name AS name, peer.slug AS slug, count(DISTINCT p) AS overlap_count
		ORDER BY overlap_count DESC
		LIMIT 10
		`
		rec, err := tx.Run(ctx, query, map[string]any{"userId": userID})
		if err != nil {
			return nil, err
		}

		var items []OverlapItem
		for rec.Next(ctx) {
			r := rec.Record()
			name, _ := r.Get("name")
			slug, _ := r.Get("slug")
			count, _ := r.Get("overlap_count")

			items = append(items, OverlapItem{
				Name:         fmt.Sprint(name),
				Slug:         fmt.Sprint(slug),
				OverlapCount: count.(int64),
			})
		}
		return items, nil
	})

	if err != nil {
		logger.Error("network overlap query failed", "err", err, "user_id", userID)
		return c.Status(500).JSON(fiber.Map{"error": "Query failed"})
	}

	return c.JSON(result)
}
