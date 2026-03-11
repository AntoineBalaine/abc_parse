const path = require("path");
const esbuild = require("esbuild");

const KAK_DIR = __dirname;

async function main() {
  // Bundle the Kakoune client
  await esbuild.build({
    entryPoints: [path.join(KAK_DIR, "src/abc-kak-client.ts")],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: path.join(KAK_DIR, "dist/abc-kak-client.js"),
    banner: {
      js: "#!/usr/bin/env node",
    },
  });

  // Bundle the install script
  await esbuild.build({
    entryPoints: [path.join(KAK_DIR, "src/install.ts")],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: path.join(KAK_DIR, "dist/install.js"),
    banner: {
      js: "#!/usr/bin/env node",
    },
  });

  console.log("abcls-kak publish bundle built successfully");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
