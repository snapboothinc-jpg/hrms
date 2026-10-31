import { createFileRoute } from "@tanstack/react-router";

/** OpenAPI 3.1 description of the versioned REST API. */
const spec = {
  openapi: "3.1.0",
  info: {
    title: "Priority Handling Logistics, Inc. API",
    version: "1.0.0",
    description:
      "Versioned REST API for Priority Handling Logistics, Inc. performance and development management. All endpoints require a Supabase access token in the Authorization header and respect the caller's row-level security scope.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    parameters: {
      cursor: {
        name: "cursor",
        in: "query",
        schema: { type: "string" },
        description: "Id of the last row of the previous page.",
      },
      limit: {
        name: "limit",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
      },
      sort: {
        name: "sort",
        in: "query",
        schema: { type: "string" },
        description: "Whitelisted field; prefix with - for descending.",
      },
      idempotencyKey: {
        name: "Idempotency-Key",
        in: "header",
        required: true,
        schema: { type: "string", maxLength: 200 },
        description:
          "Required on unsafe methods. Replays with the same key and body return the stored result.",
      },
      ifMatch: {
        name: "If-Match",
        in: "header",
        required: true,
        schema: { type: "string" },
        description: 'ETag from the last GET, e.g. W/"<id>:<version>".',
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: { code: { type: "string" }, message: { type: "string" } },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
      Employee: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          employee_code: { type: "string" },
          first_name: { type: "string" },
          last_name: { type: "string" },
          email: { type: ["string", "null"] },
          department_id: { type: "string", format: "uuid" },
          position_id: { type: "string", format: "uuid" },
          employment_status: { type: "string" },
          version: { type: "integer" },
        },
      },
      Gap: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          employee_id: { type: "string", format: "uuid" },
          competency_id: { type: "string", format: "uuid" },
          required_level: { type: "integer" },
          current_level: { type: ["integer", "null"] },
          gap: { type: "integer" },
          status: { type: "string" },
          version: { type: "integer" },
        },
      },
      Course: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string" },
          description: { type: ["string", "null"] },
          status: { type: "string" },
          duration_minutes: { type: ["integer", "null"] },
          version: { type: "integer" },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/employees": {
      get: {
        summary: "List employees (scoped)",
        parameters: [
          { $ref: "#/components/parameters/cursor" },
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/sort" },
          { name: "department_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "position_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "employment_status", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Page of employees",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Employee" } },
                    next_cursor: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthenticated",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "403": {
            description: "Forbidden",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/gaps": {
      get: {
        summary: "List competency gaps (scoped)",
        parameters: [
          { $ref: "#/components/parameters/cursor" },
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/sort" },
          { name: "employee_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "competency_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "status", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Page of gaps",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Gap" } },
                    next_cursor: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthenticated",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/courses": {
      get: {
        summary: "List courses (published or assigned, scoped)",
        parameters: [
          { $ref: "#/components/parameters/cursor" },
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/sort" },
          { name: "status", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Page of courses",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Course" } },
                    next_cursor: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/courses/{id}": {
      get: {
        summary: "Get a course",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": {
            description: "Course with ETag header",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/Course" } },
                },
              },
            },
          },
          "404": {
            description: "Not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
      patch: {
        summary: "Update a course (optimistic concurrency)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { $ref: "#/components/parameters/idempotencyKey" },
          { $ref: "#/components/parameters/ifMatch" },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string", minLength: 3, maxLength: 200 },
                  description: { type: "string", maxLength: 4000 },
                  duration_minutes: { type: "integer", minimum: 1 },
                },
                additionalProperties: false,
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated course",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/Course" } },
                },
              },
            },
          },
          "400": {
            description: "Validation failed",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "409": {
            description: "Version conflict",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "412": {
            description: "ETag mismatch",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "428": {
            description: "If-Match required",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
  },
} as const;

export const Route = createFileRoute("/api/v1/openapi/json")({
  server: {
    handlers: {
      GET: async () => Response.json(spec),
    },
  },
});
