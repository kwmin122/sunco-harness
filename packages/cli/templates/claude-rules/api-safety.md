---
patterns:
  - "src/api/**"
  - "src/routes/**"
  - "src/handlers/**"
  - "src/controllers/**"
---

# API Safety

- Validate ALL user input at the boundary. Use Zod schemas, not manual checks.
- Never trust request body/params/query without validation
- Return consistent error shapes: `{ error: string, code: string, details?: unknown }`
- Use appropriate HTTP status codes (400 for bad input, 401 for auth, 403 for authz, 404 for not found, 500 for server errors)
- Never expose stack traces in production error responses
- Rate limit all public endpoints
- Log all mutations with user context (who did what, when)
- Sanitize any user input that goes into database queries, HTML, or shell commands
