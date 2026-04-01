# Sample PRD: Task Queue Service

## Overview
Build a distributed task queue service for processing background jobs in a Node.js microservices architecture. The service must handle job scheduling, retry logic, priority queues, and dead letter handling.

## Requirements
- TypeScript + Node.js 24 LTS
- Redis-backed persistent queue with at-least-once delivery
- Priority levels: critical, high, normal, low
- Configurable retry with exponential backoff (max 5 retries)
- Dead letter queue for permanently failed jobs
- REST API for job submission and status queries
- Worker pool with configurable concurrency
- Graceful shutdown (drain in-flight jobs before exit)
- Health check endpoint with queue depth metrics
- Job scheduling (cron-like delayed execution)

## Constraints
- Must run in Docker containers (Alpine-based)
- Maximum memory: 512MB per worker
- P99 latency for job enqueue: <50ms
- Must support at least 1000 jobs/second throughput
- No external dependencies beyond Redis

## Non-functional
- Full test coverage for retry and dead letter logic
- OpenTelemetry instrumentation for observability
- Structured JSON logging (pino)
