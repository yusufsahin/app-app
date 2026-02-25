/**
 * E1: Unit tests for hasPermission (RBAC-style permission check).
 */
import { describe, it, expect } from "vitest";
import { hasPermission } from "./permissions";

describe("hasPermission", () => {
  it("returns true when user has wildcard *", () => {
    expect(hasPermission(["*"], "project:read")).toBe(true);
    expect(hasPermission(["*"], "artifact:delete")).toBe(true);
  });

  it("returns true when user has exact permission", () => {
    expect(hasPermission(["project:read"], "project:read")).toBe(true);
    expect(hasPermission(["artifact:read", "artifact:update"], "artifact:update")).toBe(true);
  });

  it("returns true when user has resource wildcard resource:*", () => {
    expect(hasPermission(["project:*"], "project:read")).toBe(true);
    expect(hasPermission(["project:*"], "project:create")).toBe(true);
    expect(hasPermission(["manifest:read", "manifest:*"], "manifest:update")).toBe(true);
  });

  it("returns false when user has no matching permission", () => {
    expect(hasPermission([], "project:read")).toBe(false);
    expect(hasPermission(["artifact:read"], "project:read")).toBe(false);
    expect(hasPermission(["project:read"], "project:create")).toBe(false);
  });

  it("returns false for empty user permissions", () => {
    expect(hasPermission([], "project:read")).toBe(false);
  });

  it("handles required with colon (resource:action)", () => {
    expect(hasPermission(["tenant:read"], "tenant:read")).toBe(true);
    expect(hasPermission(["tenant:*"], "tenant:read")).toBe(true);
    expect(hasPermission(["tenant:read"], "tenant:write")).toBe(false);
  });
});
