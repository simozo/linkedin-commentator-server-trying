package middleware

import (
	"fmt"

	"dashboard-server/database"
	"dashboard-server/logger"

	"github.com/gofiber/fiber/v2"
)

// AuthRequired reads the "session" cookie, validates it against Redis,
// and stores the user_id in Locals for downstream handlers.
func AuthRequired(c *fiber.Ctx) error {
	token := c.Cookies("session")
	if token == "" {
		logger.Warn("auth rejected: missing session cookie", "ip", c.IP(), "path", c.Path())
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	val, err := database.RedisClient.Get(database.Ctx, "session:"+token).Result()
	if err != nil {
		logger.Warn("auth rejected: session not found in Redis", "ip", c.IP(), "path", c.Path())
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Session expired or invalid"})
	}

	var userID uint
	if _, err := fmt.Sscan(val, &userID); err != nil {
		logger.Error("auth rejected: malformed session value", "err", err, "ip", c.IP())
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Malformed session"})
	}

	logger.Debug("auth ok", "user_id", userID, "path", c.Path())
	c.Locals("user_id", userID)
	return c.Next()
}
