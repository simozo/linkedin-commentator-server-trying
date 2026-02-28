package main

import (
	"log"
	"os"

	"dashboard-server/database"
	"dashboard-server/handlers"
	"dashboard-server/logger"
	"dashboard-server/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found; using environment variables instead")
	}

	// Init centralized structured logger (reads LOG_LEVEL, LOG_FORMAT from env)
	logger.Init(os.Getenv("LOG_LEVEL"), os.Getenv("LOG_FORMAT"))
	logger.Info("dashboard-server starting")

	database.ConnectRedis()
	database.ConnectNeo4j()

	app := fiber.New()
	app.Use(middleware.RequestLogger) // structured request logging
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:5001,http://127.0.0.1:5001",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET,POST,OPTIONS",
		AllowCredentials: true,
	}))

	// All API routes require a valid session cookie
	api := app.Group("/api", middleware.AuthRequired)
	api.Get("/stats", handlers.GetStats)
	api.Get("/activity", handlers.GetActivity)
	api.Get("/bridge-targets", handlers.GetBridgeTargets)
	api.Get("/connections/stats", handlers.GetConnectionsStats)
	api.Get("/connections/list", handlers.GetConnectionsList)
	api.Get("/connections/insights", handlers.GetNetworkInsights)
	api.Get("/connections/overlap", handlers.GetNetworkOverlap)

	// AI routes (Managed Claude)
	api.Post("/ai/suggest-purposes", handlers.SuggestPurposes)
	api.Post("/ai/generate-comment", handlers.GenerateComment)
	api.Get("/user/usage", handlers.GetUsage)

	port := os.Getenv("PORT")
	if port == "" {
		port = "5001"
	}
	logger.Info("dashboard-server listening", "port", port)
	log.Fatal(app.Listen(":" + port))
}
