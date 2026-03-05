package handlers

import (
	"context"
	"fmt"
	"sort"
	"time"

	"dashboard-server/database"

	"github.com/gofiber/fiber/v2"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

type StreakResponse struct {
	StreakDays    int64 `json:"streak_days"`
	IsDay7        bool  `json:"is_day7"`
	PostsAnalyzed int64 `json:"posts_analyzed"`
	ProfilesMet   int64 `json:"profiles_met"`
	CommentsLeft  int64 `json:"comments_left"`
}

// GetStreak handles GET /api/stats/streak
// Returns the current daily activity streak and aggregated stats for the day-7 panel.
func GetStreak(c *fiber.Ctx) error {
	userID := fmt.Sprint(c.Locals("user_id"))
	ctx := context.Background()
	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		rec, err := tx.Run(ctx, `
			MATCH (u:User {id: $userId})-[a:ACTION]->(p:Post)
			OPTIONAL MATCH (p)-[:AUTHORED_BY]->(person:Person)
			RETURN
				count(DISTINCT p)                                                  AS posts_analyzed,
				count(DISTINCT CASE WHEN a.type = 'comment_generated' THEN p END) AS comments_left,
				count(DISTINCT person)                                             AS profiles_met,
				collect(DISTINCT toString(date(datetime(a.timestamp))))            AS activity_dates
		`, map[string]any{"userId": userID})
		if err != nil {
			return nil, err
		}
		if !rec.Next(ctx) {
			return StreakResponse{}, nil
		}
		r := rec.Record()

		getInt := func(key string) int64 {
			v, _ := r.Get(key)
			if v == nil {
				return 0
			}
			if i, ok := v.(int64); ok {
				return i
			}
			return 0
		}

		postsAnalyzed := getInt("posts_analyzed")
		commentsLeft := getInt("comments_left")
		profilesMet := getInt("profiles_met")

		// Parse and sort activity dates descending
		datesRaw, _ := r.Get("activity_dates")
		var parsed []time.Time
		if dates, ok := datesRaw.([]any); ok {
			for _, d := range dates {
				if s, ok := d.(string); ok {
					if t, err := time.Parse("2006-01-02", s); err == nil {
						parsed = append(parsed, t.UTC())
					}
				}
			}
		}
		sort.Slice(parsed, func(i, j int) bool { return parsed[i].After(parsed[j]) })

		var streakDays int64
		if len(parsed) > 0 {
			today := time.Now().UTC().Truncate(24 * time.Hour)
			yesterday := today.Add(-24 * time.Hour)

			// Streak must start from today or yesterday
			latest := parsed[0].Truncate(24 * time.Hour)
			if latest.Equal(today) || latest.Equal(yesterday) {
				expected := latest
				for _, d := range parsed {
					day := d.Truncate(24 * time.Hour)
					if day.Equal(expected) {
						streakDays++
						expected = expected.Add(-24 * time.Hour)
					} else {
						break
					}
				}
			}
		}

		return StreakResponse{
			StreakDays:    streakDays,
			IsDay7:        streakDays >= 7,
			PostsAnalyzed: postsAnalyzed,
			ProfilesMet:   profilesMet,
			CommentsLeft:  commentsLeft,
		}, nil
	})

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}
