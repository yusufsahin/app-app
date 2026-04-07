import { test, expect, type Page } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";

/**
 * End-to-end SCM traceability: Kaynak (Source) tab, proje Git webhooks kartı,
 * GitHub/GitLab webhook POST → artifact SCM link (gerçek API + UI doğrulama).
 *
 * Önkoşul: demo seed (admin@example.com), org `demo`, proje `sample-project`, en az bir yaprak work item.
 * Çalıştırma: backend + Vite (veya PLAYWRIGHT_BASE_URL); auth.setup ile aynı ortam.
 */
const DEMO_ORG = "demo";
const SAMPLE_PROJECT_SLUG = "sample-project";

async function ensureAuthedApp(page: Page) {
  await page.goto("/");
  await expect(page).not.toHaveURL(/\/login/);
  await page.waitForLoadState("networkidle");
}

/** SPA keeps JWT in localStorage; page.request does not attach it automatically. */
async function authHeaders(page: Page): Promise<Record<string, string>> {
  const token = await page.evaluate(() => {
    const direct = localStorage.getItem("alm_access_token");
    if (direct && direct.length > 20) return direct;
    try {
      const raw = localStorage.getItem("auth-storage");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { state?: { accessToken?: string | null } };
      const t = parsed.state?.accessToken;
      return typeof t === "string" && t.length > 20 ? t : null;
    } catch {
      return null;
    }
  });
  expect(token, "Missing access token — run auth setup / ensureAuthedApp first").toBeTruthy();
  return { Authorization: `Bearer ${token}` };
}

async function getSampleProjectId(page: Page): Promise<string> {
  const headers = await authHeaders(page);
  const res = await page.request.get(`/api/v1/orgs/${DEMO_ORG}/projects`, { headers });
  expect(res.ok(), await res.text()).toBeTruthy();
  const projects = (await res.json()) as { slug: string; id: string }[];
  const p = projects.find((x) => x.slug === SAMPLE_PROJECT_SLUG);
  expect(p, `Project slug ${SAMPLE_PROJECT_SLUG} not in org ${DEMO_ORG}`).toBeTruthy();
  return p!.id;
}

type ArtifactRow = { id: string; artifact_key: string; title: string };

async function findSeededLeafArtifact(page: Page, projectId: string): Promise<ArtifactRow> {
  const headers = await authHeaders(page);
  for (const q of ["Sample work item", "Sample requirement", "Sample user story"]) {
    const res = await page.request.get(
      `/api/v1/orgs/${DEMO_ORG}/projects/${projectId}/artifacts?q=${encodeURIComponent(q)}&limit=30`,
      { headers },
    );
    expect(res.ok(), await res.text()).toBeTruthy();
    const data = (await res.json()) as { items: ArtifactRow[] };
    const re = new RegExp(q.replace(/\s+/g, "\\s+"), "i");
    const planningLeaf = new Set(["workitem", "requirement", "user_story", "feature"]);
    const preferred = data.items.find((a) => re.test(a.title) && planningLeaf.has(a.artifact_type));
    if (preferred) return preferred;
    const hit = data.items.find((a) => re.test(a.title));
    if (hit) return hit;
  }
  throw new Error("Seeded demo leaf artifact not found (expected Sample work item or similar).");
}

/** Opens artifact detail (table or tree layout — avoids relying on <tr> rows). */
async function gotoBacklogArtifactDetail(page: Page, artifactId: string) {
  await page.goto(`/${DEMO_ORG}/${SAMPLE_PROJECT_SLUG}/backlog/${artifactId}`);
  await expect(page.getByText("Loading project…")).not.toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("tab", { name: "Details" })).toBeVisible({ timeout: 15_000 });
}

async function waitForScmLinkOnArtifact(
  page: Page,
  projectId: string,
  artifactId: string,
  urlSubstring: string,
) {
  const headers = await authHeaders(page);
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await page.request.get(
      `/api/v1/orgs/${DEMO_ORG}/projects/${projectId}/artifacts/${artifactId}/scm-links`,
      { headers },
    );
    expect(res.ok(), await res.text()).toBeTruthy();
    const rows = (await res.json()) as { web_url: string }[];
    if (rows.some((r) => r.web_url.includes(urlSubstring))) return;
    await page.waitForTimeout(300);
  }
  throw new Error(`Timeout: no SCM link containing "${urlSubstring}" on artifact ${artifactId}`);
}

function githubPrBodyBytes(
  htmlUrl: string,
  number: number,
  headRef: string,
  title: string,
  repoFullName = "acme/repo-e2e",
  bodyText = "",
): Buffer {
  const payload = {
    action: "opened",
    pull_request: {
      html_url: htmlUrl,
      number,
      title,
      body: bodyText,
      head: { ref: headRef },
      merged: false,
    },
    repository: { full_name: repoFullName },
  };
  return Buffer.from(JSON.stringify(payload), "utf-8");
}

function gitlabMrBodyBytes(
  webUrl: string,
  iid: number,
  sourceBranch: string,
  title: string,
  namespacePath = "acme/gitlab-e2e",
  description = "",
): Buffer {
  const payload = {
    object_kind: "merge_request",
    object_attributes: {
      action: "open",
      state: "opened",
      iid,
      title,
      description,
      source_branch: sourceBranch,
      web_url: webUrl,
    },
    project: { path_with_namespace: namespacePath },
  };
  return Buffer.from(JSON.stringify(payload), "utf-8");
}

test.describe.serial("SCM traceability (E2E)", () => {
  test("project page shows Git webhooks card and copy controls", async ({ page }) => {
    test.setTimeout(45_000);
    await ensureAuthedApp(page);
    await page.goto(`/${DEMO_ORG}/${SAMPLE_PROJECT_SLUG}`);
    await expect(page.getByText("Loading project…")).not.toBeVisible({ timeout: 15_000 });
    await expect(page.locator("code").filter({ hasText: /\/webhooks\/github/ }).first()).toBeVisible();
    await expect(page.locator("code").filter({ hasText: /\/webhooks\/gitlab/ }).first()).toBeVisible();
    await expect(page.locator("code").filter({ hasText: /\/webhooks\/deploy/ }).first()).toBeVisible();
  });

  test("backlog Source tab: parse-preview, add manual PR link, remove", async ({ page }) => {
    test.setTimeout(90_000);
    await ensureAuthedApp(page);
    const projectId = await getSampleProjectId(page);
    const leaf = await findSeededLeafArtifact(page, projectId);
    await gotoBacklogArtifactDetail(page, leaf.id);

    await page.getByRole("tab", { name: /Source|Kaynak/i }).click();

    const unique = Date.now() % 1_000_000;
    const prUrl = `https://github.com/alm-e2e/manual-link/pull/${unique}`;

    await page.locator("#scm-web-url").fill(prUrl);
    await page.locator("#scm-web-url").blur();
    await expect(page.locator("#scm-web-url-preview")).toContainText(/github/i, { timeout: 12_000 });

    await page.getByRole("button", { name: /Add link|Bağlantı ekle/i }).click();
    await expect(page.locator(`a[href*="manual-link/pull/${unique}"]`)).toBeVisible({ timeout: 15_000 });

    await page.locator("li", { has: page.locator(`a[href*="manual-link/pull/${unique}"]`) }).getByRole("button", { name: "Remove link" }).click();
    await expect(page.locator(`a[href*="manual-link/pull/${unique}"]`)).toHaveCount(0, { timeout: 10_000 });
  });

  test("GitHub webhook POST creates SCM link visible on Source tab", async ({ page }) => {
    test.setTimeout(120_000);
    await ensureAuthedApp(page);
    const projectId = await getSampleProjectId(page);
    const leaf = await findSeededLeafArtifact(page, projectId);
    const key = leaf.artifact_key.replace(/\s+/g, "");
    const secret = `e2e-gh-wh-${randomUUID().slice(0, 8)}`;

    await page.goto(`/${DEMO_ORG}/${SAMPLE_PROJECT_SLUG}`);
    await expect(page.getByText("Loading project…")).not.toBeVisible({ timeout: 15_000 });

    await page.getByLabel(/Pause GitHub PR and push processing/i).setChecked(false);
    await page.locator("#scm-gh-secret").fill(secret);
    await page.getByRole("button", { name: /Save webhook settings|Webhook ayarlarını kaydet/i }).click();
    await expect(page.locator("#scm-gh-secret")).toHaveValue("", { timeout: 25_000 });

    const prNum = 8000 + (Date.now() % 5000);
    const htmlUrl = `https://github.com/acme/repo-e2e/pull/${prNum}`;
    const raw = githubPrBodyBytes(
      htmlUrl,
      prNum,
      `feature/${key}-e2e-branch`,
      `chore: ${key} hook`,
      "acme/repo-e2e",
      `${key}\n\nE2E webhook traceability body.`,
    );
    const sig = createHmac("sha256", secret).update(raw).digest("hex");

    const wh = await page.request.post(`/api/v1/orgs/${DEMO_ORG}/projects/${projectId}/webhooks/github`, {
      data: raw,
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": `sha256=${sig}`,
        "X-GitHub-Delivery": randomUUID(),
      },
    });
    expect(wh.ok(), await wh.text()).toBeTruthy();
    const body = (await wh.json()) as { status: string };
    expect(body.status).toBe("created");

    await waitForScmLinkOnArtifact(page, projectId, leaf.id, `/pull/${prNum}`);

    await gotoBacklogArtifactDetail(page, leaf.id);
    await page.getByRole("tab", { name: /Source|Kaynak/i }).click();
    await expect(page.locator(`a[href*="/pull/${prNum}"]`)).toBeVisible({ timeout: 15_000 });

    await page
      .locator("li", { has: page.locator(`a[href*="/pull/${prNum}"]`) })
      .getByRole("button", { name: /Remove link|Bağlantıyı kaldır/i })
      .click();
    await expect(page.locator(`a[href*="/pull/${prNum}"]`)).toHaveCount(0, { timeout: 10_000 });
  });

  test("GitLab webhook POST creates SCM link visible on Source tab", async ({ page }) => {
    test.setTimeout(120_000);
    await ensureAuthedApp(page);
    const projectId = await getSampleProjectId(page);
    const leaf = await findSeededLeafArtifact(page, projectId);
    const key = leaf.artifact_key.replace(/\s+/g, "");
    const secret = `e2e-gl-wh-${randomUUID().slice(0, 8)}`;

    await page.goto(`/${DEMO_ORG}/${SAMPLE_PROJECT_SLUG}`);
    await expect(page.getByText("Loading project…")).not.toBeVisible({ timeout: 15_000 });

    await page.getByLabel(/Pause GitLab MR and push processing/i).setChecked(false);
    await page.locator("#scm-gl-secret").fill(secret);
    await page.getByRole("button", { name: /Save webhook settings|Webhook ayarlarını kaydet/i }).click();
    await expect(page.locator("#scm-gl-secret")).toHaveValue("", { timeout: 25_000 });

    const iid = 9000 + (Date.now() % 4000);
    const webUrl = `https://gitlab.com/acme/gitlab-e2e/-/merge_requests/${iid}`;
    const raw = gitlabMrBodyBytes(
      webUrl,
      iid,
      `feature/${key}-gl-e2e`,
      `draft: ${key} gl`,
      "acme/gitlab-e2e",
      `${key}\n\nE2E GitLab MR body.`,
    );

    const wh = await page.request.post(`/api/v1/orgs/${DEMO_ORG}/projects/${projectId}/webhooks/gitlab`, {
      data: raw,
      headers: {
        "Content-Type": "application/json",
        "X-Gitlab-Event": "Merge Request Hook",
        "X-Gitlab-Token": secret,
        "X-Gitlab-Event-UUID": randomUUID(),
      },
    });
    expect(wh.ok(), await wh.text()).toBeTruthy();
    const body = (await wh.json()) as { status: string };
    expect(body.status).toBe("created");

    await waitForScmLinkOnArtifact(page, projectId, leaf.id, `merge_requests/${iid}`);

    await gotoBacklogArtifactDetail(page, leaf.id);
    await page.getByRole("tab", { name: /Source|Kaynak/i }).click();
    await expect(page.locator(`a[href*="merge_requests/${iid}"]`)).toBeVisible({ timeout: 15_000 });

    await page
      .locator("li", { has: page.locator(`a[href*="merge_requests/${iid}"]`) })
      .getByRole("button", { name: /Remove link|Bağlantıyı kaldır/i })
      .click();
    await expect(page.locator(`a[href*="merge_requests/${iid}"]`)).toHaveCount(0, { timeout: 10_000 });
  });
});
