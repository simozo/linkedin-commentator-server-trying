// Package logger provides a centralized, structured logging system
// for the dashboard-server using log/slog (Go 1.21+).
//
// Usage:
//
//	logger.Info("user authenticated", "user_id", 42)
//	logger.Warn("slow query", "duration_ms", 1230, "endpoint", "/api/stats")
//	logger.Error("neo4j query failed", "err", err, "user_id", userID)
package logger

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
)

// L is the package-level logger. All packages should import this and call L.Info, etc.
var L *slog.Logger

func init() {
	Init(os.Getenv("LOG_LEVEL"), os.Getenv("LOG_FORMAT"))
}

// Init sets up the logger. Call this from main() to override defaults.
//
//	level:  "debug" | "info" | "warn" | "error"  (default: "info")
//	format: "json" | "text"                        (default: "text")
func Init(level, format string) {
	lvl := parseLevel(level)
	var handler slog.Handler

	opts := &slog.HandlerOptions{
		Level:     lvl,
		AddSource: lvl == slog.LevelDebug, // include file:line only in debug
	}

	if strings.ToLower(format) == "json" {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(colorWriter(lvl), opts)
	}

	L = slog.New(handler)
	slog.SetDefault(L)
}

func parseLevel(s string) slog.Level {
	switch strings.ToLower(s) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// colorWriter wraps os.Stdout; at debug level it passes through to stderr so
// normal app output and debug logs can be separated if desired.
func colorWriter(lvl slog.Level) io.Writer {
	if lvl == slog.LevelDebug {
		return os.Stderr
	}
	return os.Stdout
}

// ── Convenience wrappers ─────────────────────────────────────────────────────

func Debug(msg string, args ...any) { L.Debug(msg, args...) }
func Info(msg string, args ...any)  { L.Info(msg, args...) }
func Warn(msg string, args ...any)  { L.Warn(msg, args...) }
func Error(msg string, args ...any) { L.Error(msg, args...) }

// With returns a child logger with the given key-value attributes pre-set.
// Useful for per-request or per-handler scoped loggers.
func With(args ...any) *slog.Logger { return L.With(args...) }

// WithContext attaches a logger to a context (useful for tracing).
func WithContext(ctx context.Context, args ...any) context.Context {
	return context.WithValue(ctx, ctxKey{}, L.With(args...))
}

// FromContext retrieves a logger from context (falls back to global L).
func FromContext(ctx context.Context) *slog.Logger {
	if l, ok := ctx.Value(ctxKey{}).(*slog.Logger); ok {
		return l
	}
	return L
}

type ctxKey struct{}
