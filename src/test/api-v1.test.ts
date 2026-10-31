import { describe, expect, it } from "vitest";
import {
  canonicalCoursePatch,
  coursePatchSchema,
  decodeCursor,
  ifMatchVersion,
  isAfterCursor,
  paginate,
} from "@/lib/api/v1.server";

const ids = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
  "00000000-0000-4000-8000-000000000005",
];

const rows = [
  {
    id: ids[2],
    title: "Shared title",
    created_at: "2026-10-03T00:00:00.000Z",
    last_name: "Zulu",
    employee_code: "E-3",
  },
  {
    id: ids[0],
    title: "Alpha",
    created_at: "2026-10-01T00:00:00.000Z",
    last_name: "Alpha",
    employee_code: "E-1",
  },
  {
    id: ids[4],
    title: "Shared title",
    created_at: "2026-10-02T00:00:00.000Z",
    last_name: "Zulu",
    employee_code: "E-2",
  },
  {
    id: ids[1],
    title: "Bravo",
    created_at: "2026-10-04T00:00:00.000Z",
    last_name: "Bravo",
    employee_code: "E-4",
  },
  {
    id: ids[3],
    title: "Charlie",
    created_at: "2026-10-02T00:00:00.000Z",
    last_name: "Charlie",
    employee_code: "E-5",
  },
];

describe("REST course PATCH validation", () => {
  it("accepts partial updates without materializing omitted fields", () => {
    expect(coursePatchSchema.parse({ title: "Revised course" })).toEqual({
      title: "Revised course",
    });
    expect(coursePatchSchema.parse({ duration_minutes: 45 })).toEqual({
      duration_minutes: 45,
    });
  });

  it("rejects empty patches, invalid values, and unsupported fields", () => {
    expect(coursePatchSchema.safeParse({}).success).toBe(false);
    expect(coursePatchSchema.safeParse({ title: null }).success).toBe(false);
    expect(coursePatchSchema.safeParse({ duration_minutes: 2.5 }).success).toBe(false);
    expect(coursePatchSchema.safeParse({ owner_id: ids[0] }).success).toBe(false);
  });

  it("canonicalizes equivalent payloads for stable idempotency hashes", () => {
    const first = coursePatchSchema.parse({ title: "Revised course", description: "Details" });
    const second = coursePatchSchema.parse({ description: "Details", title: "Revised course" });
    expect(canonicalCoursePatch(first)).toBe(canonicalCoursePatch(second));
  });

  it("requires a matching resource ETag and extracts its expected version", () => {
    const id = ids[0];
    const request = new Request("https://example.test/api/v1/courses/" + id, {
      headers: { "If-Match": `W/"${id}:7"` },
    });
    expect(ifMatchVersion(request, id)).toBe(7);
    const stale = new Request(request.url, { headers: { "If-Match": `W/"${id}:6"` } });
    expect(ifMatchVersion(stale, ids[1])).toBeInstanceOf(Response);
    expect(ifMatchVersion(new Request(request.url), id)).toBeInstanceOf(Response);
  });
});

describe("compound REST cursors", () => {
  const sortFields = ["created_at", "title", "last_name", "employee_code"] as const;

  for (const column of sortFields) {
    for (const ascending of [true, false]) {
      it(`traverses ${column} ${ascending ? "ascending" : "descending"} without duplicates`, () => {
        const ordered = [...rows].sort((left, right) => {
          const a = left[column];
          const b = right[column];
          const primary = ascending ? a.localeCompare(b) : b.localeCompare(a);
          return primary || left.id.localeCompare(right.id);
        });
        const seen: string[] = [];
        let remaining = ordered;
        let cursorToken: string | null = null;
        do {
          const page = paginate(remaining, 2, { column, ascending });
          seen.push(...page.data.map((row) => row.id));
          cursorToken = page.next_cursor;
          if (cursorToken) {
            const cursor = decodeCursor(cursorToken, column, ascending);
            expect(cursor).not.toBeNull();
            remaining = ordered.filter((row) => isAfterCursor(row[column], row.id, cursor!));
          }
        } while (cursorToken);
        expect(seen).toEqual(ordered.map((row) => row.id));
        expect(new Set(seen).size).toBe(rows.length);
      });
    }
  }

  it("rejects malformed or sort-mismatched cursor values", () => {
    const token = paginate(rows, 1, { column: "title", ascending: true }).next_cursor!;
    expect(decodeCursor(token, "title", true)).not.toBeNull();
    expect(decodeCursor(token, "title", false)).toBeNull();
    expect(decodeCursor("not-a-cursor", "title", true)).toBeNull();
  });
});
