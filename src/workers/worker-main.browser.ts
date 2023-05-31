import { wrap } from "comlink";
import type { VCDiffWorker } from "./worker-thread";

const worker = new Worker(new URL("./worker-thread.js", import.meta.url).href, {
  type: "module",
});
const VCDiff = wrap<VCDiffWorker>(worker);

export async function encode(from: Uint8Array, to: Uint8Array) {
  return VCDiff.encode(from, to);
}

export async function decode(from: Uint8Array, delta: Uint8Array) {
  return VCDiff.decode(from, delta);
}
