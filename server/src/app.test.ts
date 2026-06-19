import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app";

describe("app", () => {
  it("returns health status", async () => {
    const app = createApp();

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});

