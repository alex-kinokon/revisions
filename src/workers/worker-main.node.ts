import { Worker as NodeWorker } from "node:worker_threads";
import { resolve } from "node:path";
import { wrap } from "comlink";
import nodeEndpoint from "comlink/dist/umd/node-adapter.js";
import type { VCDiffWorker } from "./worker-thread";

const worker = new NodeWorker(resolve(__dirname, "worker-thread.js"));
const VCDiff = wrap<VCDiffWorker>(nodeEndpoint(worker));

export async function encode(from: Uint8Array, to: Uint8Array) {
  return VCDiff.encode(from, to);
}

export async function decode(from: Uint8Array, delta: Uint8Array) {
  return VCDiff.decode(from, delta);
}
