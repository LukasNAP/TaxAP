import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the TaxAP prototype", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>TaxAP \| Sales and use tax rate monitoring<\/title>/i);
  assert.match(html, /Atlantic Packaging/);
  assert.match(html, /TaxAP/);
  assert.match(html, /Know which tax rates need attention\./);
  assert.match(html, /North Carolina pilot/);
  assert.match(html, /Prototype · sample data/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/);
});

test("keeps the prototype read-only and removes starter assets", async () => {
  const [page, readme, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /No A\+ records will be changed\./);
  assert.match(readme, /No automatic A\+ changes/);
  assert.match(readme, /ADDR\.SASTXB/);
  assert.match(readme, /Atlantic branding/);
  assert.doesNotMatch(page, /TaxWatch/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
