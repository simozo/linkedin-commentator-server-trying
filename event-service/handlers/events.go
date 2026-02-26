package handlers

import (
	"encoding/json"
	"fmt"
	"time"

	"event-service/database"

	"github.com/gofiber/fiber/v2"
)

type CoCommenter struct {
	Name           string `json:"name"`
	Slug           string `json:"slug"`
	CommentSnippet string `json:"comment_snippet"`
}

type Event struct {
	UserID          string        `json:"user_id"`
	PostUrn         string        `json:"post_urn"`
	URL             string        `json:"url"`
	Action          string        `json:"action"`
	AuthorName      string        `json:"author_name"`
	AuthorSlug      string        `json:"author_slug"`
	AuthorDegree    string        `json:"author_degree"`
	PostText        string        `json:"post_text"`
	InteractionType string        `json:"interaction_type"`
	InteractorName  string        `json:"interactor_name"`
	InteractorSlug  string        `json:"interactor_slug"`
	CoCommenters    []CoCommenter `json:"co_commenters"`
	Timestamp       time.Time     `json:"timestamp"`
}

func ReceiveEvent(c *fiber.Ctx) error {
	var event Event
	if err := c.BodyParser(&event); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate required fields
	if event.PostUrn == "" || event.Action == "" || event.AuthorSlug == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing required fields (post_urn, action, author_slug)"})
	}

	// Inject the authenticated User ID explicitly from Context (to avoid payload tampering)
	userID := c.Locals("user_id")
	event.UserID = fmt.Sprintf("%.0f", userID.(float64))
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	// Serialize the sanitized event and push to Redis queue
	data, err := json.Marshal(event)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to process event details"})
	}

	err = database.RedisClient.LPush(database.Ctx, "events_queue", data).Err()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to queue event"})
	}

	return c.JSON(fiber.Map{"status": "ok"})
}
