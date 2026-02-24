package handlers

import (
	"encoding/json"
	"fmt"
	"time"

	"event-service/database"

	"github.com/gofiber/fiber/v2"
)

type Event struct {
	UserID    string    `json:"user_id"`
	URL       string    `json:"url"`
	Title     string    `json:"title"`
	Action    string    `json:"action"`
	CreatedAt time.Time `json:"created_at"`
}

func ReceiveEvent(c *fiber.Ctx) error {
	var event Event
	if err := c.BodyParser(&event); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate required fields
	if event.URL == "" || event.Title == "" || event.Action == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing required fields (url, title, action)"})
	}

	// Inject the authenticated User ID explicitly from Context (to avoid payload tampering)
	userID := c.Locals("user_id")
	event.UserID = fmt.Sprintf("%.0f", userID.(float64))
	event.CreatedAt = time.Now()

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
