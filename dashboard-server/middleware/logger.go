package middleware

import (
	"time"

	"dashboard-server/logger"

	"github.com/gofiber/fiber/v2"
)

// RequestLogger logs every incoming request with method, path, status code,
// latency, and user_id. It also logs request/response bodies for debugging.
func RequestLogger(c *fiber.Ctx) error {
	start := time.Now()

	// Capture request body (limit size for safety)
	reqBody := string(c.Request().Body())
	if len(reqBody) > 4096 {
		reqBody = reqBody[:4096] + "... (truncated)"
	}

	// Process request
	err := c.Next()

	latency := time.Since(start)
	status := c.Response().StatusCode()
	uid := c.Locals("user_id")

	// Capture response body (limit size for safety)
	respBody := string(c.Response().Body())
	if len(respBody) > 4096 {
		respBody = respBody[:4096] + "... (truncated)"
	}

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

	// Log with bodies (using debug level if needed, or structured attributes)
	logMsg := "request processed"
	if status >= 400 {
		logMsg = "request failed"
	}

	fullAttrs := append(attrs, "req_body", reqBody, "resp_body", respBody)

	switch {
	case status >= 500:
		logger.Error(logMsg, fullAttrs...)
	case status >= 400:
		logger.Warn(logMsg, fullAttrs...)
	default:
		logger.Info(logMsg, fullAttrs...)
	}

	return err
}
