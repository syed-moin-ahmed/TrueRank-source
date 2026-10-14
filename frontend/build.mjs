// Builds the React app into frontend/dist, which Flask serves at http://127.0.0.1:5000
//   npm run build        production build (minified)
//   npm run dev          rebuild automatically on every save (refresh the browser to see changes)
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const watch = process.argv.includes("--watch");
const outdir = "dist";

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });
cpSync("public", outdir, { recursive: true, filter: (src) => !src.endsWith("index.html") });

function writeIndex(metafile) {
  const outputs = Object.keys(metafile.outputs);
  const js = outputs.find((f) => f.endsWith(".js"));
  const css = outputs.find((f) => f.endsWith(".css"));
  const toUrl = (f) => "/" + path.relative(outdir, f).split(path.sep).join("/");
  const html = readFileSync("public/index.html", "utf8")
    .replace("%APP_CSS%", css ? `<link rel="stylesheet" href="${toUrl(css)}">` : "")
    .replace("%APP_JS%", `<script type="module" src="${toUrl(js)}"></script>`);
  writeFileSync(path.join(outdir, "index.html"), html);
}

const writeIndexPlugin = {
  name: "write-index",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length === 0 && result.metafile) {
        writeIndex(result.metafile);
        console.log(`[${new Date().toLocaleTimeString()}] build ok`);
      }
    });
  },
};

const options = {
  entryPoints: ["src/main.jsx"],
  bundle: true,
  outdir: path.join(outdir, "assets"),
  entryNames: "[name]-[hash]",
  assetNames: "[name]-[hash]",
  format: "esm",
  jsx: "automatic",
  minify: !watch,
  sourcemap: watch,
  target: ["chrome100", "safari15", "firefox100", "edge100"],
  define: { "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production") },
  loader: { ".svg": "file", ".png": "file", ".jpg": "file" },
  metafile: true,
  logLevel: "warning",
  plugins: [writeIndexPlugin],
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("Watching for changes... (Ctrl+C to stop)");
} else {
  await esbuild.build(options);
}
