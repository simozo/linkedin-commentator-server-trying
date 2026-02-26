package middleware

import (
	"time"

	"dashboard-server/logger"

	"github.com/gofiber/fiber/v2"
)

// RequestLogger logs every incoming request with method, path, status code,
// latency, and user_id (if available from session middleware).
func RequestLogger(c *fiber.Ctx) error {
	start := time.Now()

	err := c.Next()

	latency := time.Since(start)
	status := c.Response().StatusCode()

	uid := c.Locals("user_id")

	attrs := []any{
		"method", c.Method(),
		"path", c.Path(),
		"status", status,
		"latency_ms", latency.Milliseconds(),
		"ip", c.IP(),
	}
	if uid != nil {
		attrs = append(attrs, "user_id", uid)
	}

	switch {
	case status >= 500:
		logger.Error("request", attrs...)
	case status >= 400:
		logger.Warn("request", attrs...)
	default:
		logger.Info("request", attrs...)
	}

	return err
}
