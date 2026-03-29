import { expect, type Page } from "@playwright/test";

export class QualityWorkspacePage {
  constructor(private readonly page: Page) {}

  private getRouteContext() {
    const current = new URL(this.page.url());
    const seg = current.pathname.split("/").filter(Boolean);
    const orgSlug = seg[0];
    const projectSlug = seg[1];
    return { current, orgSlug, projectSlug };
  }

  async openCatalog() {
    await this.page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Catalog" }).click();
    await this.page.waitForURL(/\/quality\/catalog/, { timeout: 10000 });
  }

  /** Quality → Campaign workspace (`/quality/campaign`; legacy `/quality/suites` redirects). */
  async openCampaign() {
    await this.page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Campaign" }).click();
    await this.page.waitForURL(/\/quality\/campaign/, { timeout: 10000 });
  }

  async openRuns() {
    await this.page.locator('[data-sidebar="sidebar"]').getByRole("link", { name: "Runs" }).click();
    await this.page.waitForURL(/\/quality\/runs/, { timeout: 10000 });
  }

  async selectFirstQualityFolder() {
    // Scope to the catalog tree (Groups); avoid the root row’s ⋮ menu button (was nth(1) fallback).
    const treeAside = this.page.locator("aside").filter({ has: this.page.getByText("Groups", { exact: true }) });
    const folderRow = treeAside.locator('[data-artifact-type="quality-folder"]').first();
    await folderRow.click({ timeout: 15000, force: true });
    await expect(this.page).toHaveURL(/under=[0-9a-f-]{36}/i, { timeout: 10000 });
  }

  /** First campaign collection (`testsuite-folder`) in the Collections panel. */
  async selectFirstCampaignCollection() {
    const treeAside = this.page.locator("aside").filter({ has: this.page.getByText("Collections", { exact: true }) });
    const folderRow = treeAside.locator('[data-artifact-type="testsuite-folder"]').first();
    await folderRow.click({ timeout: 15000, force: true });
    await expect(this.page).toHaveURL(/under=[0-9a-f-]{36}/i, { timeout: 10000 });
  }

  /** First test suite leaf in the Campaign tree (tree-detail: no center Items list). */
  async selectFirstCampaignSuite() {
    const treeAside = this.page.locator("aside").filter({ has: this.page.getByText("Collections", { exact: true }) });
    const suiteRow = treeAside.locator('[data-artifact-type="test-suite"]').first();
    await suiteRow.click({ timeout: 15000, force: true });
    await expect(this.page).toHaveURL(/artifact=[0-9a-f-]{36}/i, { timeout: 10000 });
  }

  /** Opens the suite catalog (dock or dialog: “Add tests from Catalog”). */
  async openSuiteTestLinkEditor() {
    const addTests = this.page.getByTestId("quality-suite-add-tests");
    const manageLinks = this.page.getByTestId("quality-link-manage-modal");
    if (await addTests.isVisible().catch(() => false)) {
      await addTests.click();
      return;
    }
    await expect(manageLinks).toBeVisible({ timeout: 15000 });
    await manageLinks.click();
  }

  /** Campaign: dock panel (`quality-suite-catalog-panel`). Other contexts: modal dialog. */
  suiteLinkEditor() {
    const dock = this.page.getByTestId("quality-suite-catalog-panel");
    const dialog = this.page.getByRole("dialog", { name: "Add tests from Catalog" });
    return dock.or(dialog);
  }

  private async ensureUnderParam() {
    const current = new URL(this.page.url());
    if (current.searchParams.get("under")) return;
    await this.selectFirstQualityFolder().catch(() => undefined);
    const afterClick = new URL(this.page.url());
    if (afterClick.searchParams.get("under")) return;

    // Fallback: use root-quality id when no concrete folder is visible.
    const seg = afterClick.pathname.split("/").filter(Boolean);
    const orgSlug = seg[0];
    const projectSlug = seg[1];
    if (!orgSlug || !projectSlug) return;
    const rootRes = await this.page.request.get(`/api/v1/orgs/${orgSlug}/projects/${projectSlug}/artifacts?tree=quality&include_system_roots=true&limit=200`);
    if (!rootRes.ok()) return;
    const data = (await rootRes.json()) as { items?: Array<{ id: string; artifact_type: string }> };
    const root = (data.items ?? []).find((i) => i.artifact_type === "root-quality");
    if (!root) return;
    afterClick.searchParams.set("under", root.id);
    await this.page.goto(afterClick.toString());
    await expect(this.page).toHaveURL(/under=[0-9a-f-]{36}/i, { timeout: 10000 });
  }

  /** Opens the create modal from the workspace header or, on Catalog tree layout, from the folder ⋮ menu. */
  private async clickCreateInQualityWorkspace() {
    await this.ensureUnderParam();
    const createButtonByTestId = this.page.getByTestId("quality-create-button");
    const headerReady =
      (await createButtonByTestId.isVisible().catch(() => false)) &&
      (await createButtonByTestId.isEnabled().catch(() => false));
    if (headerReady) {
      await createButtonByTestId.click();
      return;
    }
    const under = new URL(this.page.url()).searchParams.get("under");
    expect(under).toBeTruthy();
    await this.page.getByTestId(`quality-tree-folder-menu-${under}`).click();
    const newLeaf = this.page.getByTestId(`quality-tree-new-leaf-${under}`);
    await newLeaf.waitFor({ state: "visible", timeout: 10000 });
    await newLeaf.click();
  }

  async createItemFromModal(title: string) {
    const createButtonByRole = this.page.getByRole("button", { name: /Create (test case|suite|run|campaign)/i });
    const headerCreate = this.page.getByTestId("quality-create-button");
    const campaignSuiteCta = this.page
      .getByTestId("quality-testsuites-collection-create-cta")
      .or(this.page.getByTestId("quality-campaign-create-suite-cta"));
    const headerReady =
      (await headerCreate.isVisible().catch(() => false)) &&
      (await headerCreate.isEnabled().catch(() => false));
    if (headerReady) {
      await headerCreate.click();
    } else if (await campaignSuiteCta.isVisible().catch(() => false)) {
      await campaignSuiteCta.click();
    } else if (await this.page.getByTestId("quality-tree-detail-panel").isVisible().catch(() => false)) {
      await this.clickCreateInQualityWorkspace();
    } else {
      await this.ensureUnderParam();
      await createButtonByRole.click();
    }

    const modalTitleInputByTestId = this.page.getByTestId("artifact-modal-title-input");
    await modalTitleInputByTestId.waitFor({ state: "visible", timeout: 20000 }).catch(() => undefined);
    const dialog = this.page.getByRole("dialog");
    const modalTitleInputByRole = dialog.getByRole("textbox", { name: /enter title|title/i }).first();
    const hasModalInput = await modalTitleInputByTestId.isVisible().catch(() => false);
    if (hasModalInput || (await dialog.isVisible().catch(() => false))) {
      if (hasModalInput) await modalTitleInputByTestId.fill(title);
      else await modalTitleInputByRole.fill(title);
      const createModalButton = this.page
        .getByTestId("artifact-modal-create")
        .or(dialog.getByRole("button", { name: /Create/i }).first());
      if (await createModalButton.isDisabled().catch(() => false)) {
        const addStepButton = this.page.getByTestId("step-add-button");
        if (await addStepButton.isVisible().catch(() => false)) {
          await addStepButton.click();
          await this.page.getByLabel(/action/i).first().fill("Open the target page");
          await this.page.getByLabel(/expected result/i).first().fill("Page loads successfully");
        }
      }
      await createModalButton.click();
    } else {
      await this.page.getByPlaceholder(/Create .* title/i).fill(title);
      await createButtonByRole.click();
    }
    await expect(this.page.getByText(title).first()).toBeVisible({ timeout: 20000 });
  }

  /** Create a test-case artifact with N steps (action text per step). Requires Catalog page + steps editor. */
  async createTestCaseWithStepActions(title: string, actions: string[]) {
    await this.ensureUnderParam();
    const headerCreate = this.page.getByTestId("quality-create-button");
    const headerReady =
      (await headerCreate.isVisible().catch(() => false)) &&
      (await headerCreate.isEnabled().catch(() => false));
    if (headerReady) {
      await headerCreate.click();
    } else {
      await this.clickCreateInQualityWorkspace();
    }

    const titleInput = this.page.getByTestId("artifact-modal-title-input");
    await titleInput.waitFor({ state: "visible", timeout: 20000 });
    await titleInput.fill(title);

    const modal = this.page.getByTestId("quality-artifact-modal");
    for (let i = 0; i < actions.length; i++) {
      await modal.getByTestId("step-add-button").click();
      await modal.getByLabel(/action/i).nth(i).fill(actions[i]!);
    }

    await this.page.getByTestId("artifact-modal-create").click();
    await expect(this.page.getByText(title).first()).toBeVisible({ timeout: 20000 });
  }

  async findQualityArtifactIdByTitle(title: string, artifactType: string) {
    const { orgSlug, projectSlug } = this.getRouteContext();
    expect(orgSlug).toBeTruthy();
    expect(projectSlug).toBeTruthy();
    const res = await this.page.request.get(
      `/api/v1/orgs/${orgSlug}/projects/${projectSlug}/artifacts?tree=quality&include_system_roots=true&limit=500`,
    );
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()) as {
      items?: Array<{ id: string; artifact_type: string; title: string }>;
    };
    const item = (data.items ?? []).find((i) => i.artifact_type === artifactType && i.title === title);
    expect(item?.id).toBeTruthy();
    return item!.id;
  }

  async openLeafEditFromTree(artifactId: string) {
    await this.page.getByTestId(`quality-tree-leaf-menu-${artifactId}`).click();
    await this.page.getByTestId(`quality-tree-leaf-edit-${artifactId}`).click();
    await this.page.getByTestId("artifact-modal-title-input").waitFor({ state: "visible", timeout: 15000 });
  }

  async clearFolderFilter() {
    const clearByTestId = this.page.getByTestId("quality-tree-clear-filter");
    if (await clearByTestId.isVisible().catch(() => false)) {
      await clearByTestId.click({ timeout: 10000 });
    } else {
      await this.page.getByRole("button", { name: /Clear (group|collection) filter/i }).click({ timeout: 10000 });
    }
    await expect(this.page).not.toHaveURL(/under=/i, { timeout: 10000 });
  }

  async selectedFolderIdFromUrl() {
    const { current } = this.getRouteContext();
    const under = current.searchParams.get("under");
    expect(under).toMatch(/^[0-9a-f-]{36}$/i);
    return under as string;
  }

  async createSubfolderUnder(parentFolderId: string, title: string) {
    await this.page.getByTestId(`quality-tree-folder-menu-${parentFolderId}`).click();
    const createSubfolder = this.page.getByTestId(`quality-tree-create-subfolder-${parentFolderId}`);
    await expect(createSubfolder).toBeVisible({ timeout: 10000 });
    await createSubfolder.click();
    await this.page.getByTestId("artifact-modal-title-input").waitFor({ state: "visible", timeout: 15000 });
    await this.page.getByTestId("artifact-modal-title-input").fill(title);
    await this.page.getByTestId("artifact-modal-create").click();
    await expect(this.page.getByText(title).first()).toBeVisible({ timeout: 20000 });
  }

  async findFolderIdByTitle(title: string) {
    const { orgSlug, projectSlug } = this.getRouteContext();
    expect(orgSlug).toBeTruthy();
    expect(projectSlug).toBeTruthy();
    const res = await this.page.request.get(
      `/api/v1/orgs/${orgSlug}/projects/${projectSlug}/artifacts?tree=quality&include_system_roots=true&limit=500`,
    );
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()) as {
      items?: Array<{ id: string; artifact_type: string; title: string }>;
    };
    const item = (data.items ?? []).find((i) => i.artifact_type === "quality-folder" && i.title === title);
    expect(item?.id).toBeTruthy();
    return item!.id;
  }

  async renameFolderById(folderId: string, newTitle: string) {
    await this.page.getByTestId(`quality-tree-folder-menu-${folderId}`).click();
    await this.page.getByTestId(`quality-tree-folder-rename-${folderId}`).click();
    await this.page.getByTestId("artifact-modal-title-input").waitFor({ state: "visible", timeout: 15000 });
    await this.page.getByTestId("artifact-modal-title-input").fill(newTitle);
    await this.page.getByTestId("artifact-modal-save").click();
    await expect(this.page.getByText(newTitle).first()).toBeVisible({ timeout: 20000 });
  }

  async deleteFolderById(folderId: string, titleToDisappear: string) {
    await this.page.getByTestId(`quality-tree-folder-menu-${folderId}`).click();
    await this.page.getByTestId(`quality-tree-folder-delete-${folderId}`).click();
    await this.page.getByTestId("artifact-modal-delete-confirm").click();
    await expect(this.page.getByText(titleToDisappear).first()).toHaveCount(0, { timeout: 20000 });
  }
}

