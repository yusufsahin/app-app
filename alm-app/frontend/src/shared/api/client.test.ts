/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios, { AxiosError, AxiosHeaders } from "axios";

import { apiClient } from "./client";
import { useAuthStore } from "../stores/authStore";

function getRequestFulfilled() {
  const handlers = (apiClient.interceptors.request as { handlers?: Array<{ fulfilled?: (arg: unknown) => unknown }> }).handlers ?? [];
  return handlers[0]!.fulfilled!;
}

function getResponseRejected() {
  const handlers = (apiClient.interceptors.response as { handlers?: Array<{ rejected?: (arg: unknown) => unknown }> }).handlers ?? [];
  return handlers[0]!.rejected!;
}

describe("apiClient interceptors", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      roles: [],
      permissions: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds Authorization header when access token exists", async () => {
    useAuthStore.setState({ accessToken: "token-123" });
    const fulfilled = getRequestFulfilled();

    const config = (await fulfilled({ headers: new AxiosHeaders() } as never)) as {
      headers: AxiosHeaders & { Authorization?: string };
    };

    expect(config?.headers.Authorization).toBe("Bearer token-123");
  });

  it("leaves headers unchanged when access token is missing", async () => {
    const fulfilled = getRequestFulfilled();

    const config = (await fulfilled({ headers: new AxiosHeaders() } as never)) as {
      headers: AxiosHeaders & { Authorization?: string };
    };

    expect(config?.headers.Authorization).toBeUndefined();
  });

  it("rejects 401 with original axios error and logs out", async () => {
    const logout = vi.fn();
    useAuthStore.setState({ logout });
    const rejected = getResponseRejected();
    const hrefState = { href: "", origin: "https://app.example" };
    vi.stubGlobal("window", { location: hrefState });

    const error = new AxiosError(
      "Unauthorized",
      undefined,
      undefined,
      undefined,
      {
        status: 401,
        statusText: "Unauthorized",
        data: { detail: "expired" },
        headers: {},
        config: { headers: {} as never },
      },
    );

    await expect(rejected(error)).rejects.toBe(error);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(hrefState.href).toBe("https://app.example/login?reason=session-expired");
  });

  it("rejects non-401 axios response with problem detail payload", async () => {
    const rejected = getResponseRejected();
    const error = new AxiosError(
      "Forbidden",
      undefined,
      undefined,
      undefined,
      {
        status: 403,
        statusText: "Forbidden",
        data: { detail: "nope", status: 403, title: "Forbidden" },
        headers: {},
        config: { headers: {} as never },
      },
    );

    await expect(rejected(error)).rejects.toEqual({ detail: "nope", status: 403, title: "Forbidden" });
  });

  it("passes through non-axios errors unchanged", async () => {
    const rejected = getResponseRejected();
    const error = new Error("plain");
    vi.spyOn(axios, "isAxiosError").mockReturnValue(false);

    await expect(rejected(error)).rejects.toBe(error);
  });
});
