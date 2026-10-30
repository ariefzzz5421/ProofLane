import { test, expect } from "@playwright/test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
const nonce = () => Math.random().toString(36).slice(2, 10);
test("developer creates a campaign, sees persisted counts, and mobile page does not overflow", async ({
  page,
  request,
}) => {
  const suffix = nonce();
  await page.goto("/register");
  await page.locator('form[data-hydrated="true"]').waitFor();
  await page.getByLabel("Organization name").fill(`Test ${suffix}`);
  await page.getByLabel("Organization slug").fill(`test-${suffix}`);
  await page.getByLabel("Email").fill(`owner-${suffix}@example.com`);
  await page.getByLabel("Password").fill("safe-password-1234");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "New campaign" }).first().click();
  await page.getByLabel("Campaign name").fill(`Campaign ${suffix}`);
  await page.getByLabel("Unique slug").fill(`campaign-${suffix}`);
  await page.getByLabel("Maximum accepted applicants").fill("3");
  await page.getByLabel("Initial status").selectOption("live");
  await page
    .getByRole("button", { name: "Create campaign and add tasks" })
    .click();
  await expect(page).toHaveURL(/\/tasks$/);
  const url = page.url();
  const campaignId = url.split("/")[5];
  await page.getByLabel("Task title").fill("Verify wallet");
  await page.getByLabel("Verification type").selectOption("wallet");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Verify wallet")).toBeVisible();
  const response = await request.get(`/api/v1/campaigns/${campaignId}`);
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data.campaign.acceptedCount).toBe(0);
  expect(JSON.stringify(data)).not.toMatch(
    /secret_hash|password_hash|api_key/i,
  );
  const keyResponse = await page.request.post("/api/v1/admin/keys", {
    data: { name: "E2E stats", scopes: ["stats:read"] },
  });
  expect(keyResponse.status()).toBe(201);
  const createdKey = await keyResponse.json();
  const publicAfterKey = await request.get(`/api/v1/campaigns/${campaignId}`);
  expect(JSON.stringify(await publicAfterKey.json())).not.toContain(
    createdKey.key,
  );
  expect(
    (
      await request.get(`/api/v1/campaigns/${campaignId}/stats`, {
        headers: { authorization: `Bearer ${createdKey.key}` },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.get(`/api/v1/campaigns/${campaignId}/applicants`, {
        headers: { authorization: `Bearer ${createdKey.key}` },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await page.request.delete(`/api/v1/admin/keys/${createdKey.id}`)).status(),
  ).toBe(200);
  expect(
    (
      await request.get(`/api/v1/campaigns/${campaignId}/stats`, {
        headers: { authorization: `Bearer ${createdKey.key}` },
      })
    ).status(),
  ).toBe(403);
  const snapshot = await page.request.post(
    `/api/v1/campaigns/${campaignId}/snapshot`,
  );
  expect(snapshot.status()).toBe(201);
  const snapshotData = await snapshot.json();
  expect(snapshotData.rowCount).toBe(0);
  const exported = await page.request.get(snapshotData.downloadUrl);
  expect(exported.status()).toBe(200);
  expect(await exported.text()).toBe("chain_id,wallet_address,accepted_at\n");
  expect(exported.headers()["x-qk-checksum-sha256"]).toBe(
    snapshotData.checksum,
  );
  await page.goto(`/c/campaign-${suffix}`);
  await expect(page.getByText("3 places remain")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await expect(
    page.getByRole("button", { name: "Submit application" }),
  ).toBeDisabled();
});

test("another organization cannot read private applicants", async ({
  browser,
}) => {
  const suffix = nonce();
  const owner = await browser.newContext();
  const other = await browser.newContext();
  const first = await owner.request.post("/api/v1/admin/register", {
    data: {
      email: `one-${suffix}@example.com`,
      password: "safe-password-1234",
      organization: "First Org",
      slug: `first-${suffix}`,
    },
  });
  expect(first.status()).toBe(201);
  const org = (await first.json()).organizationId;
  const created = await owner.request.post("/api/v1/campaigns", {
    data: {
      organizationId: org,
      name: "Private campaign",
      slug: `private-${suffix}`,
      chainId: 1,
      maxApplicants: 5,
      status: "live",
    },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).id;
  const second = await other.request.post("/api/v1/admin/register", {
    data: {
      email: `two-${suffix}@example.com`,
      password: "safe-password-1234",
      organization: "Second Org",
      slug: `second-${suffix}`,
    },
  });
  expect(second.status()).toBe(201);
  const forbidden = await other.request.get(
    `/api/v1/campaigns/${id}/applicants`,
  );
  expect(forbidden.status()).toBe(403);
  const invite = await owner.request.post("/api/v1/admin/members", {
    data: { email: `two-${suffix}@example.com`, role: "viewer" },
  });
  expect(invite.status()).toBe(201);
  expect(
    (await other.request.get(`/api/v1/campaigns/${id}/applicants`)).status(),
  ).toBe(200);
  const viewerWrite = await other.request.post("/api/v1/campaigns", {
    data: {
      organizationId: org,
      name: "Viewer cannot write",
      slug: `forbidden-${suffix}`,
      chainId: 1,
      maxApplicants: 2,
      status: "draft",
    },
  });
  expect(viewerWrite.status()).toBe(403);
  await owner.close();
  await other.close();
});

test("SIWE wallet task, committed application, lookup and duplicate retry", async ({
  request,
}) => {
  const campaignId = "00000000-0000-4000-8000-000000000002";
  const taskId = "00000000-0000-4000-8000-000000000003";
  const account = privateKeyToAccount(generatePrivateKey());
  const challenge = await request.post("/api/v1/auth/challenge", {
    data: { address: account.address, chainId: 1 },
  });
  expect(challenge.status()).toBe(200);
  const { message } = await challenge.json();
  const signature = await account.signMessage({ message });
  const auth = await request.post("/api/v1/auth/verify", {
    data: { message, signature },
  });
  expect(auth.status()).toBe(200);
  const replay = await request.post("/api/v1/auth/verify", {
    data: { message, signature },
  });
  expect(replay.status()).toBe(401);
  const early = await request.post(
    `/api/v1/campaigns/${campaignId}/applications`,
    { data: { idempotencyKey: `early-${nonce()}` } },
  );
  expect(early.status()).toBe(400);
  expect((await early.json()).error.code).toBe("TASKS_REQUIRED");
  const verify = await request.post(
    `/api/v1/campaigns/${campaignId}/verify-task`,
    { data: { taskId, status: "verified" } },
  );
  expect(verify.status()).toBe(200);
  expect((await verify.json()).status).toBe("verified");
  const submit = await request.post(
    `/api/v1/campaigns/${campaignId}/applications`,
    { data: { idempotencyKey: `apply-${nonce()}` } },
  );
  expect(submit.status()).toBe(201);
  const first = await submit.json();
  expect(first.status).toBe("accepted");
  const lookup = await request.get(
    `/api/v1/campaigns/${campaignId}/applications/me`,
  );
  expect((await lookup.json()).application.id).toBe(first.applicationId);
  const duplicate = await request.post(
    `/api/v1/campaigns/${campaignId}/applications`,
    { data: { idempotencyKey: `retry-${nonce()}` } },
  );
  expect(duplicate.status()).toBe(200);
  expect((await duplicate.json()).applicationId).toBe(first.applicationId);
});

test("responsive landing and campaign pages at representative widths", async ({
  page,
}) => {
  for (const width of [360, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `landing overflow at ${width}px`,
    ).toBeTruthy();
    await page.goto("/c/demo-builder-registration");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `campaign overflow at ${width}px`,
    ).toBeTruthy();
  }
  await page.screenshot({
    path: "test-results/campaign-desktop.png",
    fullPage: true,
  });
});
