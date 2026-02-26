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
		AllowOrigins:     "http://localhost:3000,http://localhost:3001",
		AllowHeaders:     "Origin, Content-Type, Accept",
		AllowMethods:     "GET,POST,OPTIONS",
		AllowCredentials: true,
	}))

	// All API routes require a valid session cookie
	api := app.Group("/api", middleware.AuthRequired)
	api.Get("/stats", handlers.GetStats)
	api.Get("/activity", handlers.GetActivity)
	api.Get("/bridge-targets", handlers.GetBridgeTargets)

	port := os.Getenv("PORT")
	if port == "" {
		port = "5001"
	}
	logger.Info("dashboard-server listening", "port", port)
	log.Fatal(app.Listen(":" + port))
}
