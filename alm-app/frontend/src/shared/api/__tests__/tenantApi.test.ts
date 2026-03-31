/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import type { ReactNode } from "react";

import { apiClient } from "../client";
import { useAuthStore } from "../../stores/authStore";
import { useTenantStore } from "../../stores/tenantStore";
import {
    useCreateTenant,
    useInviteMember,
    useMyTenants,
    type TenantListItem,
    type TenantResponse,
} from "../tenantApi";

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return ({ children }: { children: ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("tenantApi hooks", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        useAuthStore.setState({
            user: null,
            accessToken: null,
            refreshToken: null,
            roles: [],
            permissions: [],
        });
        useTenantStore.setState({
            currentTenant: null,
            tenants: [],
            roles: [],
            permissions: [],
        });
    });

    it("does not fetch my tenants when access token is missing", async () => {
        const getSpy = vi.spyOn(apiClient, "get");
        const { result } = renderHook(() => useMyTenants(), { wrapper: createWrapper() });

        await waitFor(() => {
            expect(result.current.fetchStatus).toBe("idle");
        });
        expect(getSpy).not.toHaveBeenCalled();
    });

    it("fetches my tenants when access token is present", async () => {
        const payload: TenantListItem[] = [
            { id: "t1", name: "Tenant 1", slug: "tenant-1", tier: "free", roles: ["admin"] },
        ];
        vi.spyOn(apiClient, "get").mockResolvedValue({ data: payload } as never);
        useAuthStore.setState({ accessToken: "token-123" });

        const { result } = renderHook(() => useMyTenants(), { wrapper: createWrapper() });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });
        expect(result.current.data).toEqual(payload);
    });

    it("create tenant sends Authorization header when tokenOverride is provided", async () => {
        const payload: TenantResponse = {
            id: "t1",
            name: "Tenant 1",
            slug: "tenant-1",
            tier: "free",
        };
        const postSpy = vi.spyOn(apiClient, "post").mockResolvedValue({ data: payload } as never);

        const { result } = renderHook(() => useCreateTenant("override-token"), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            const out = await result.current.mutateAsync({ name: "Tenant 1" });
            expect(out).toEqual(payload);
        });

        expect(postSpy).toHaveBeenCalledWith(
            "/tenants/",
            { name: "Tenant 1" },
            { headers: { Authorization: "Bearer override-token" } },
        );
    });

    it("invite member uses current tenant id from store", async () => {
        useTenantStore.setState({
            currentTenant: { id: "tenant-42", name: "T", slug: "t" },
        });
        const postSpy = vi.spyOn(apiClient, "post").mockResolvedValue({
            data: {
                id: "inv-1",
                email: "new@example.com",
                roles: ["member"],
                expires_at: "2030-01-01T00:00:00Z",
            },
        } as never);

        const { result } = renderHook(() => useInviteMember(), { wrapper: createWrapper() });

        await act(async () => {
            await result.current.mutateAsync({ email: "new@example.com", role_ids: ["r1"] });
        });

        expect(postSpy).toHaveBeenCalledWith("/tenants/tenant-42/invite", {
            email: "new@example.com",
            role_ids: ["r1"],
        });
    });
});
