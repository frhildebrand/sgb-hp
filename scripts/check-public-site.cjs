const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const { default: Eleventy } = await import("@11ty/eleventy");
  const site = new Eleventy("src", undefined, {
    config: (config) => config.ignores.add("src/intranet/**"),
  });
  const pages = await site.toJSON();
  const byUrl = new Map(pages.map((page) => [page.url, page.content]));
  const errors = new Set();
  for (const page of pages) {
    const references = [
      ...page.content.matchAll(/\b(?:href|src)=["']([^"']+)["']/g),
      ...page.content.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g),
    ];
    for (const [, reference] of references) {
      if (/^(?:[a-z]+:|\/\/)/i.test(reference)) continue;
      const url = new URL(reference.replaceAll("&amp;", "&"), `https://local${page.url}`);
      const pathname = decodeURIComponent(url.pathname);
      const target = byUrl.get(pathname) || byUrl.get(`${pathname.replace(/\/$/, "")}/`);
      const asset = path.join("src", pathname);
      const isAsset = fs.existsSync(asset) && fs.statSync(asset).isFile();
      if (!target && !isAsset && !pathname.startsWith("/assets/fontawesome/")) {
        errors.add(`${page.url}: missing ${pathname}`);
      } else if (target && url.hash) {
        const id = decodeURIComponent(url.hash.slice(1));
        if (!target.includes(`id="${id}"`) && !target.includes(`id='${id}'`)) {
          errors.add(`${page.url}: missing anchor ${pathname}${url.hash}`);
        }
      }
    }
  }
  assert.equal(errors.size, 0, [...errors].join("\n"));
  assert(!byUrl.has("/tags/all/"), "Internal collections must not become tag pages");
  assert(!byUrl.has("/tags/news/"), "The news collection must not become a tag page");
  console.log(`Checked ${pages.length} public pages and their local references.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
