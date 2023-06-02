#!/usr/bin/env -S node -r esbuild-register
import { promises as fs } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import type { BuildOptions, Plugin } from "esbuild";
import esbuild from "esbuild";
import pkg from "./package.json";

const ENV = process.env.NODE_ENV || "development";
const PROD = ENV === "production";

const options: BuildOptions = {
  bundle: true,
  minify: PROD,
  // sourcemap: PROD,
  platform: "node",
  target: "esnext",
  external: ["comlink", "comlink/dist/umd/node-adapter.js"],
  loader: {
    ".bin": "binary",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(ENV),
  },
};

async function bundle(platform: "browser" | "node") {
  const plugin: Plugin = {
    name: "resolveWorker",
    setup(build) {
      build.onResolve({ filter: /worker-(main|thread)/ }, ({ path, importer }) => {
        if (path.includes(platform)) {
          return null;
        }
        const ext = extname(path);
        const name = path.slice(0, ext ? -ext.length : undefined);
        return { path: resolve(dirname(importer), `${name}.${platform}${ext || ".ts"}`) };
      });
    },
  };

  await esbuild.build({
    ...options,
    entryPoints: [`./src/workers/worker-thread.${platform}.ts`],
    outfile: `dist/${platform}/worker-thread.js`,
    format: "esm",
    platform,
    plugins: [plugin],
  });

  await esbuild.build({
    ...options,
    entryPoints: ["./src/index.ts"],
    outdir: `dist/${platform}`,
    format: platform === "browser" ? "esm" : "cjs",
    logOverride: {
      "empty-import-meta": "silent",
    },
    platform,
    plugins: [plugin],
  });
}

async function main() {
  await bundle("node");
  await bundle("browser");

  const nodeWorker = "dist/node/worker-thread.js";
  const result = await esbuild.transform(await fs.readFile(nodeWorker, "utf8"), {
    loader: "js",
    format: "cjs",
    minify: PROD,
  });
  await fs.writeFile(nodeWorker, result.code);

  Object.assign(pkg, {
    main: "./node/index.js",
    private: undefined,
    devDependencies: undefined,
    scripts: undefined,
    upstream: undefined,
    prettier: undefined,
    exports: {
      ".": {
        node: "./node/index.js",
        browser: "./browser/index.js",
      },
    },
  });

  await fs.writeFile("dist/package.json", JSON.stringify(pkg, null, 2));
}

main();
