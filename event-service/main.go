package main

import (
	"log"
	"os"

	"event-service/database"
	"event-service/handlers"
	"event-service/middlewares"
	"event-service/worker"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found; using environment variables instead")
	}

	// Inizializza Servizi Database
	database.ConnectRedis()
	database.ConnectNeo4j()
	defer database.Neo4jDriver.Close(database.Ctx)

	// Inizializza Server HTTP
	app := fiber.New()
	app.Use(logger.New())

	// TODO: refine CORS on production
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-Signature",
	}))

	// Protected Endpoint Eventi (Applica JWT + HMAC)
	protected := app.Group("/events", middlewares.JWTProtected(), middlewares.HMACProtected())
	protected.Post("/", handlers.ReceiveEvent)

	// Protected Endpoint Connessioni (Stesso schema auth)
	connections := app.Group("/connections", middlewares.JWTProtected(), middlewares.HMACProtected())
	connections.Post("/batch", handlers.ImportConnections)

	// Avvia Worker Background Queue->Graph
	go worker.StartFlush()

	// Listen su Porta Assegnata
	port := os.Getenv("PORT")
	if port == "" {
		port = "3100"
	}
	log.Fatal(app.Listen(":" + port))
}
