import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/lib/alwrity-db", () => ({
  alwrityPool: { query: vi.fn() },
}));

import { alwrityPool } from "@/server/lib/alwrity-db";
import { AppError } from "@/server/lib/errors";
import { resolveClientId } from "@/server/lib/client-context";

const mockedQuery = alwrityPool.query as unknown as ReturnType<typeof vi.fn>;

function makeHeaders(init: Record<string, string> = {}): Headers {
  return new Headers(init);
}

describe("resolveClientId", () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it("returns null when X-Client-ID header is absent", async () => {
    await expect(resolveClientId(makeHeaders())).resolves.toBeNull();
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("throws FORBIDDEN when header is not a UUID", async () => {
    await expect(
      resolveClientId(makeHeaders({ "X-Client-ID": "not-a-uuid" })),
    ).rejects.toMatchObject({ code: "FORBIDDEN" } satisfies Partial<AppError>);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("returns the id when client exists in alwrity.clients", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    mockedQuery.mockResolvedValueOnce({ rows: [{ id }] });
    await expect(
      resolveClientId(makeHeaders({ "X-Client-ID": id })),
    ).resolves.toBe(id);
  });

  it("throws FORBIDDEN when the client UUID is unknown/archived", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      resolveClientId(makeHeaders({ "X-Client-ID": id })),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("accepts lowercase and mixed-case header name", async () => {
    const id = "33333333-3333-4333-8333-333333333333";
    mockedQuery.mockResolvedValueOnce({ rows: [{ id }] });
    await expect(
      resolveClientId(makeHeaders({ "x-client-id": id })),
    ).resolves.toBe(id);
  });
});
