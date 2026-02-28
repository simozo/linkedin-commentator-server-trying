package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

func main() {
	if err := godotenv.Load("../event-service/.env"); err != nil {
		log.Println("No .env file found")
	}

	redisAddr := os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	ctx := context.Background()
	rdb := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	len, err := rdb.LLen(ctx, "events_queue").Result()
	if err != nil {
		log.Fatalf("Failed to get queue length: %v", err)
	}

	fmt.Printf("Events in queue: %d\n", len)

	if len > 0 {
		events, _ := rdb.LRange(ctx, "events_queue", 0, 5).Result()
		for i, e := range events {
			fmt.Printf("[%d]: %s\n", i, e)
		}
	}
}
