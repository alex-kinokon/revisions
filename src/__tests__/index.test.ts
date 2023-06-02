import { readFileSync } from "fs";
import { resolve } from "node:path";
import { describe, it } from "mocha";
import { expect } from "expect";
import { Revisions } from "../../dist/";

const read = (path: string) =>
  new Uint8Array(readFileSync(new URL(path, import.meta.url)));

const e = (text: string) => new TextEncoder().encode(text);
const d = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("revisions", () => {
  it("should diff and store Wikipedia texts faithfully", async () => {
    const revisionPath = resolve(
      __dirname,
      "./fixtures/wikipedia-article.generated.json"
    );
    const revisions: string[] = JSON.parse(readFileSync(revisionPath, "utf-8"));

    const list = new Revisions();
    for (const revision of revisions) {
      await list.push(e(revision));
    }

    expect(list.length).toBe(revisions.length);

    for (let i = 0; i < revisions.length; i++) {
      const revision = await list.get(i);
      if (d(revision) !== revisions[i]) {
        expect(false).toBe(true);
      }
    }
  });

  it("should diff and store binary data faithfully", async function () {
    this.timeout(20_000);

    const photo = [
      read("./fixtures/japan-passport-1.generated.png"),
      read("./fixtures/japan-passport-2.generated.png"),
      read("./fixtures/japan-passport-3.generated.png"),
      read("./fixtures/japan-passport-4.generated.png"),
    ];

    const list = new Revisions();
    for (const revision of photo) {
      await list.push(revision);
    }

    expect(list.length).toBe(photo.length);

    for (let i = 0; i < photo.length; i++) {
      expect(await list.get(i)).toEqual(photo[i]);
    }
  });

  it("should support async iterator", async () => {
    const list = new Revisions();
    const items = [
      e("hello"),
      e("world"),
      e("foo"),
      e("bar"),
      e("baz"),
      new Uint8Array([1, 2, 3]),
    ];

    for (const item of items) {
      await list.push(item);
    }

    for await (const item of list) {
      expect(item).toEqual(items.shift());
    }
  });
});
