/**
 * Digital Twin mock server generation prompt builder for sunco test-gen.
 *
 * Builds a prompt that generates Express mock server code mimicking external APIs.
 * The generated server is self-contained and can be used for integration testing
 * without hitting real external services.
 *
 * Requirements: VRF-10
 * Decisions: D-18 (Digital Twin mock server), REV-04 (external API mocking)
 */

/**
 * Build a Digital Twin mock server generation prompt.
 *
 * @param apiDocs - API documentation or OpenAPI spec content describing the external API
 * @param endpoints - List of endpoint paths to mock (e.g., ['GET /users', 'POST /orders'])
 * @returns Formatted prompt string for the mock server generation agent
 */
export function buildTestGenMockPrompt(
  apiDocs: string,
  endpoints: string[],
): string {
  const endpointList = endpoints
    .map((e, i) => `${i + 1}. \`${e}\``)
    .join('\n');

  return `You are a Digital Twin mock server generation agent. Your task is to generate a self-contained Express.js mock server that mimics the behavior of an external API for testing purposes.

## API Documentation

${apiDocs}

## Endpoints to Mock

${endpointList}

## Instructions

1. **Generate a complete Express.js server** that implements each listed endpoint.
2. **Return realistic mock data** that matches the API documentation:
   - Use plausible values (not "test123" or "foo")
   - Respect documented data types and constraints
   - Include proper HTTP status codes
3. **Handle common scenarios**:
   - Success responses (200, 201)
   - Validation errors (400) for missing/invalid fields
   - Not found responses (404) for missing resources
   - Use in-memory storage for stateful endpoints (CRUD)
4. **Make it self-contained**: The generated server must run with only express as a dependency.
5. **Add request logging**: Log incoming requests for debugging.
6. **Include CORS headers**: Allow all origins for local testing.

## Output Format

\`\`\`json
{
  "mockServer": "complete Express.js server code as a single string",
  "endpoints": [
    {
      "method": "GET",
      "path": "/users",
      "description": "Returns list of mock users"
    }
  ]
}
\`\`\`

Only output the JSON. No explanation before or after.`;
}
