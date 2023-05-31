#!/usr/bin/env -S node -r esbuild-register
async function main() {
  const params = {
    action: "query",
    prop: "revisions",
    titles: "United States",
    rvslots: "*",
    rvlimit: 500,
    rvprop: "content",
    formatversion: 2,
    format: "json",
  };
  const res = await fetch(
    "https://en.wikipedia.org/w/api.php?" + new URLSearchParams(params as any)
  );
  const json = await res.json();

  const contents = (json.query.pages[0].revisions as any[]).map(
    r => r.slots.main.content
  );

  console.log(JSON.stringify(contents, null, 2));
}

main();
