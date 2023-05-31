const fs = require("fs");
const { fileURLToPath } = require("url");
const esbuild = require("esbuild");
const extensionsRegex = /\.(ts|tsx|mts|cts)$/;

/**
 * @param {string} url
 * @param {{ conditions: string[], format?: string | null, importAssertions }} context
 * @param {(...args) => any} nextLoad
 * @returns
 */
async function load(url, context, nextLoad) {
  if (extensionsRegex.test(url)) {
    const { source } = await nextLoad(url, { format: "module" });
    return {
      format: "module",
      shortCircuit: true,
      source: esbuild.transformSync(source, {
        loader: "ts",
        format: "esm",
      }).code,
    };
  } else if (url.endsWith(".bin")) {
    const buffer = fs.readFileSync(fileURLToPath(url));
    return {
      format: "module",
      shortCircuit: true,
      source:
        "export default Buffer.from(" +
        JSON.stringify(buffer.toString("base64")) +
        ", 'base64')",
    };
  }

  // let Node.js handle all other URLs
  return nextLoad(url, context, nextLoad);
}

exports.load = load;
