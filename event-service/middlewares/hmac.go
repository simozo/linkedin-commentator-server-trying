package middlewares

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"event-service/database"

	"github.com/gofiber/fiber/v2"
)

func HMACProtected() fiber.Handler {
	return func(c *fiber.Ctx) error {
		signature := c.Get("X-Signature")
		if signature == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Missing X-Signature header"})
		}

		userID := c.Locals("user_id")
		if userID == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized user context"})
		}

		// Convert float64 from JSON unmarshaling to string/rune correctly
		uid := fmt.Sprintf("%.0f", userID.(float64))

		// Get session secret from Redis
		secretKey, err := database.RedisClient.Get(database.Ctx, "secret:"+uid).Result()
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Session expired or invalid"})
		}

		// Calculate HMAC
		body := c.Body()
		mac := hmac.New(sha256.New, []byte(secretKey))
		mac.Write(body)
		expectedMAC := hex.EncodeToString(mac.Sum(nil))

		if !hmac.Equal([]byte(signature), []byte(expectedMAC)) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid signature mismatch"})
		}

		return c.Next()
	}
}
