# InkAPI — Blog Backend with Redis Caching & Test Suite (2026)

## Project Overview & Architecture

InkAPI is a production-style blog backend designed for fast content delivery, authenticated author actions, and resilient API performance. The application exposes a RESTful interface for blogging workflows such as creating posts, commenting, liking content, and fetching paginated feed data.

The architecture is intentionally layered for scalability and clarity:

- API Layer: Node.js + Express powers the HTTP endpoints and authentication middleware.
- Application Logic: Resource controllers handle post creation, retrieval, updates, deletes, and social interactions.
- Persistence: PostgreSQL stores users, posts, comments, and likes with database-enforced integrity rules.
- Caching: Upstash Redis sits in front of hot read endpoints using a cache-aside pattern to reduce repeated database hits.
- Testing: Jest and Supertest validate API behavior end-to-end, including authorization and cache headers.

A typical request path looks like this:

1. Client sends a request to an endpoint such as `/api/posts`.
2. Express routes the request to the relevant controller.
3. Read-heavy endpoints first check Redis for a cached payload.
4. If missing, PostgreSQL is queried and the result is stored in Redis for subsequent requests.
5. Write operations update or delete state in PostgreSQL and invalidate related Redis keys to keep data consistent.

## Tech Stack

- Node.js
- Express.js
- PostgreSQL (Neon/Postgres-compatible database)
- Upstash Redis
- Jest
- Supertest
- JWT Authentication
- bcrypt password hashing

## Core Features

- Blog post CRUD operations with author-based authorization
- Comment creation on individual posts
- Like functionality with database-enforced uniqueness constraints
- Cursor-style paginated list reads for scalable feed access
- Redis-backed cache invalidation for content updates and writes
- JWT-based authenticated access for protected endpoints
- Secure password hashing via bcrypt

### Key Data Integrity Rules

The likes workflow includes a DB-level unique constraint to prevent duplicate likes from the same user on the same post. This ensures the application enforces business rules in PostgreSQL rather than relying only on application logic.

## Redis Cache-Aside & Performance

InkAPI implements a cache-aside strategy for read-heavy endpoints. Before hitting PostgreSQL, the API checks Redis for cached payloads using keys such as `posts:page:<page>:limit:<limit>` and `post:<id>`.

When a cache miss occurs, the application fetches the data from PostgreSQL, stores it in Redis with a TTL, and returns the result to the client. For mutation operations (create, update, delete, comment, like), the relevant Redis keys are invalidated to ensure the next read reflects the latest state.

This pattern reduces repetitive database overhead on hot endpoints. In benchmark-style testing, the blog listing endpoint moved from roughly 150ms to around 10ms under repeated reads, with Redis returning cached payloads in under a few milliseconds.

The API also emits `X-Cache` response headers:

- `X-Cache: MISS` when data is retrieved from PostgreSQL and cached
- `X-Cache: HIT` when data is served from Redis

This makes it easy to validate caching behavior in both local testing and production monitoring.

## Automated Testing Suite

The project includes an automated test suite built with Jest and Supertest to validate core API flows.

### Test Coverage Includes

- User registration and login
- Authenticated post creation
- Cached paginated post retrieval
- Cache hit/miss verification via `X-Cache` headers
- Authorization checks for unauthorized deletion/edit attempts

### Running the tests

```bash
npm test
```

The suite is designed to exercise real HTTP requests against the Express app while verifying expected status codes, payloads, and caching behavior.

## Environment Variables Template

Create a `.env` file in the project root with the following values:

```env
PORT=3000
DATABASE_URL=postgresql://username:password@host:5432/database?sslmode=require
REDIS_URL=redis://default:password@host:6379
JWT_SECRET=your_super_secret_key_here
```

Notes:

- `DATABASE_URL` should point to your PostgreSQL instance.
- `REDIS_URL` should be the Upstash connection string for your Redis instance.
- `JWT_SECRET` should be a long, random string used to sign access tokens.

## API Endpoints

| Method | Endpoint | Auth Required | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | Register a new user |
| POST | `/api/auth/login` | No | Login and receive a JWT token |
| GET | `/api/posts?page=1&limit=10` | No | Fetch paginated posts from Redis or PostgreSQL |
| GET | `/api/posts/:id` | No | Fetch a single post with associated comments |
| POST | `/api/posts` | Yes | Create a new blog post |
| PUT | `/api/posts/:id` | Yes | Update an existing post authored by the user |
| DELETE | `/api/posts/:id` | Yes | Delete a post if authorized |
| POST | `/api/posts/:id/comments` | Yes | Add a comment to a post |
| POST | `/api/posts/:id/like` | Yes | Like a post; duplicate likes are rejected by the database |



## Summary

InkAPI demonstrates practical backend engineering patterns for modern APIs: secure authentication, relational data integrity, Redis caching for scale, and a strong automated test strategy. It is suitable as a portfolio project, interview-ready backend example, or foundation for a larger blogging platform.
