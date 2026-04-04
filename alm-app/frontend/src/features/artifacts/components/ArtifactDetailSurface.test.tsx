/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArtifactDetailSurface } from "./ArtifactDetailSurface";

vi.mock("../../../shared/components/ui", async () => {
  const actual = await vi.importActual<typeof import("../../../shared/components/ui")>("../../../shared/components/ui");
  return {
    ...actual,
    Sheet: ({ children, open }: { children: ReactNode; open?: boolean }) => (
      <div data-testid="sheet" data-open={String(open)}>
        {children}
      </div>
    ),
    SheetContent: ({ children }: { children: ReactNode }) => (
      <div data-testid="sheet-content">
        {children}
      </div>
    ),
    SheetTitle: ({ children, className: _c }: { children?: ReactNode; className?: string }) => (
      <div data-testid="sheet-title">{children}</div>
    ),
    SheetDescription: ({ children, className: _c }: { children?: ReactNode; className?: string }) => (
      <div data-testid="sheet-desc">{children}</div>
    ),
  };
});

describe("ArtifactDetailSurface", () => {
  it("page mode: footer renders below scrollable detail body", () => {
    render(
      <ArtifactDetailSurface isPage open onOpenChange={vi.fn()} footer={<footer data-testid="strip">Task strip</footer>}>
        <main data-testid="detail-main">Body</main>
      </ArtifactDetailSurface>,
    );

    const page = screen.getByLabelText("Artifact details page");
    expect(within(page).getByTestId("detail-main")).toBeInTheDocument();
    expect(within(page).getByTestId("strip")).toBeInTheDocument();
    expect(within(page).getByText("Task strip")).toBeInTheDocument();
    expect(page.querySelector(".overflow-y-auto")).toBeTruthy();
  });

  it("sheet mode: renders sheet with scroll region and optional footer", () => {
    render(
      <ArtifactDetailSurface
        isPage={false}
        open
        onOpenChange={vi.fn()}
        footer={<div data-testid="footer">Pinned</div>}
      >
        <div data-testid="scroll-child">Content</div>
      </ArtifactDetailSurface>,
    );

    expect(screen.getByTestId("sheet")).toHaveAttribute("data-open", "true");
    const content = screen.getByTestId("sheet-content");
    expect(within(content).getByTestId("scroll-child")).toBeInTheDocument();
    expect(within(content).getByTestId("footer")).toHaveTextContent("Pinned");
  });

  it("sheet mode: omits footer when undefined", () => {
    render(
      <ArtifactDetailSurface isPage={false} open onOpenChange={vi.fn()}>
        <div>Only body</div>
      </ArtifactDetailSurface>,
    );
    const content = screen.getByTestId("sheet-content");
    expect(within(content).getByText("Only body")).toBeInTheDocument();
  });
});
