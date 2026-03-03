# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LinkedIn activity analytics platform with a browser extension that collects LinkedIn interaction data. The system enables users to see trends in their network, identify bridge connections, and generate AI-assisted comments on posts.

## Architecture

Four independent services communicate over defined ports:

```
Browser Extension (TypeScript/MV3)
    │
    ├── POST /events → Event Service (:3100)      [JWT + HMAC auth]
    │
    └── Auth flow → Auth Service (:4000)           [LinkedIn OAuth2 + local]

Dashboard Web App (Next.js :3000)
    └── /api/* → Dashboard Server (:5001)          [session cookie or JWT]
                      ├── Neo4j (graph queries)
                      └── Claude API (AI features)

Infrastructure (Docker Compose):
    PostgreSQL (:15432)  — user accounts (Auth Service)
    Redis (:6379)        — event queue + signing secrets + session tokens
    Neo4j (:7474/:7687)  — social graph (events flushed by worker)
```

### Auth Service (`auth-service/`, port 4000)
Go/Fiber microservice. Handles LinkedIn OAuth2 and local email/password login. On login, generates RS256 JWT + a random HMAC signing secret (stored in Redis with TTL), returning both to the caller. Also creates a web session cookie (stored in Redis) for Dashboard UI access. Uses GORM with PostgreSQL.

Key files: `handlers/auth.go` (register/login), `handlers/linkedin.go` (OAuth2), `handlers/session.go` (JWT + signing secret generation), `models/user.go`.

### Event Service (`event-service/`, port 3100)
Go/Fiber microservice. Receives events from the browser extension. Every request passes through two middlewares in sequence: JWT verification (`middlewares/jwt.go`, uses `public.pem`) then HMAC signature check (`middlewares/hmac.go`, reads signing secret from Redis). Validated events are pushed to a Redis list (`events_queue`). Two background goroutines run: `worker/flush.go` (drains queue → Neo4j every 10s) and `worker/weight_worker.go` (updates relationship weights in Neo4j every 60s when graph is dirty).

### Dashboard Server (`dashboard-server/`, port 5001)
Go/Fiber API server. All routes under `/api` require `middleware/session.go` which accepts either a session cookie (Redis lookup) or a Bearer JWT. Queries Neo4j for stats, trends, activity, connections, and bridge targets. Calls Anthropic Claude API directly (`handlers/ai.go`) for comment generation and purpose suggestion. Uses `claude-sonnet-4-5` model via plain HTTP (not SDK). Free-tier users are limited to 5 AI-generated comments per day (enforced via Neo4j ACTION count query).

Key handlers: `stats.go`, `trends.go`, `activity.go`, `bridge.go`, `connections.go`, `ai.go`, `usage.go`.

### Web App (`web-app/`, port 3000)
Next.js 16 / React 19 / TypeScript app. Dashboard UI at `/dashboard` with sub-pages: stats, trends, activity, network, reach. Auth callback handling at `/auth/callback`. Talks to Dashboard Server via fetch.

## Development Commands

### Infrastructure
```bash
docker-compose up -d          # Start PostgreSQL, Redis, Neo4j
docker-compose down           # Stop all
```

Neo4j browser UI: `http://localhost:7474` (neo4j / password123)

### Go Services
Each service is an independent Go module. Run from the service directory:

```bash
# Auth Service
cd auth-service && go run main.go

# Event Service
cd event-service && go run main.go

# Dashboard Server
cd dashboard-server && go run main.go

# Dependency management (in each service directory)
go mod tidy
go build ./...
```

### Web App
```bash
cd web-app
npm install
npm run dev       # Development server
npm run build     # Production build
npm run lint      # ESLint
```

## Environment Variables

Each service reads a `.env` file. Key variables:

**auth-service/.env**
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis address
- `JWT_PRIVATE_KEY_PATH` — path to `private.pem`
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URL`
- `PORT` (default: 4000)

**event-service/.env**
- `REDIS_URL`
- `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`
- `JWT_PUBLIC_KEY_PATH` — path to `public.pem`
- `PORT` (default: 3100)

**dashboard-server/.env**
- `REDIS_URL`
- `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`
- `ANTHROPIC_API_KEY`
- `LOG_LEVEL`, `LOG_FORMAT`
- `PORT` (default: 5001)

**web-app/.env.local**
- `NEXT_PUBLIC_AUTH_URL` — Auth Service URL
- `NEXT_PUBLIC_DASHBOARD_API_URL` — Dashboard Server URL

## Key Architectural Patterns

**RSA Key Pair**: Auth Service signs JWTs with `private.pem`; Event Service and Dashboard Server verify with `public.pem`. Copy `public.pem` from auth-service to the other services before running.

**Redis `graph:dirty` flag**: The flush worker sets this flag after writing events to Neo4j. The weight worker checks it before running; resets it after completing. This avoids redundant weighting cycles.

**Event User ID injection**: The Event Service ignores `user_id` in the request body and injects it from the JWT claims to prevent payload tampering (`handlers/events.go`).

**Neo4j Graph Schema**: Core node types: `User`, `Person`, `Post`, `Topic`. Core relationships: `ACTION` (user on post), `COMMENTED_ON`, `AUTHORED_BY`, `AMPLIFIED`, `MENTIONS`, `HAS_TOPIC`, `CONNECTED_TO`. Relationship weights assigned by type (MENTIONS=10, AUTHORED_BY=8, COMMENTED_ON=5, AMPLIFIED=2).

**Bridge/Warm Reach query**: The `bridge.go` handler executes a 2-hop co-commenter Cypher traversal: `Me → ACTION → Post ← COMMENTED_ON ← Bridge ← COMMENTED_ON → Post2 ← COMMENTED_ON ← Target`, ordering by summed relationship weights.
