const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log("[watch] build finished");
    });
  },
};

async function main() {
  // Build the LSP server
  const serverCtx = await esbuild.context({
    entryPoints: ["../abc-lsp-server/src/server.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: !production,
    platform: "node",
    outfile: "dist/server.js",
    logLevel: "silent",
    plugins: [esbuildProblemMatcherPlugin],
    // Shim import.meta.url for svgdom which uses it to locate font files
    define: {
      "import.meta.url": "_importMetaUrl",
    },
    banner: {
      js: "const _importMetaUrl = require('url').pathToFileURL(__filename).href;",
    },
  });

  // Build the Kakoune client
  const clientCtx = await esbuild.context({
    entryPoints: ["src/abc-kak-client.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: !production,
    platform: "node",
    outfile: "dist/abc-kak-client.js",
    logLevel: "silent",
    plugins: [esbuildProblemMatcherPlugin],
    banner: {
      js: "#!/usr/bin/env node",
    },
  });

  if (watch) {
    await Promise.all([serverCtx.watch(), clientCtx.watch()]);
  } else {
    await Promise.all([serverCtx.rebuild(), clientCtx.rebuild()]);
    await Promise.all([serverCtx.dispose(), clientCtx.dispose()]);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
