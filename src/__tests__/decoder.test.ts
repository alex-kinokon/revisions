import { readFileSync } from "node:fs";
import { describe, it } from "mocha";
import { expect } from "expect";
import { decode, encode } from "../vcdiff-wasm/index.ts";

const read = (path: string) =>
  new Uint8Array(readFileSync(new URL(path, import.meta.url)));

describe("decoder", () => {
  it("should decode angular", async () => {
    const source = read("./fixtures/angular1.2.min.js");
    const changed = read("./fixtures/angular1.5.min.js");

    const delta = encode(source, changed);
    const reconstructed = decode(source, delta);
    expect(reconstructed).toEqual(changed);
  });

  describe("should work with xdelta data", () => {
    for (let i = 1; i <= 4; i++) {
      it(`should decode xdelta data ${i}`, function () {
        this.timeout(10_000);
        const folder = `./fixtures/xdelta/${i}`;
        const source = read(`${folder}/dictionary`);
        const delta = read(`${folder}/delta`);
        const target = read(`${folder}/target`);

        const reconstructed = decode(source, delta);
        expect(reconstructed).toEqual(target);
      });
    }
  });
});
