import { parentPort } from "node:worker_threads";
import { expose } from "comlink";
import nodeEndpoint from "comlink/dist/umd/node-adapter.js";

export type { VCDiffWorker };

class VCDiffWorker {
  #lib: any;

  async #getLib() {
    return (this.#lib ??= await import("../vcdiff-wasm/index"));
  }

  async encode(from: Uint8Array, to: Uint8Array) {
    const lib = await this.#getLib();
    return lib.encode(from, to);
  }

  async decode(from: Uint8Array, delta: Uint8Array) {
    const lib = await this.#getLib();
    return lib.decode(from, delta);
  }
}

expose(new VCDiffWorker(), nodeEndpoint(parentPort!));
