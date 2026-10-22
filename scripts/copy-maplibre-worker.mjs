// MapLibre 6 loads its web worker as a separate module file, which Next's bundler doesn't emit.
// Copy the worker (and the shared chunk it imports) into public/ so the app can serve it.
// Runs on `npm install` via the postinstall script.
import { copyFile, mkdir } from "node:fs/promises";

const from = new URL("../node_modules/maplibre-gl/dist/", import.meta.url);
const to = new URL("../public/maplibre/", import.meta.url);

await mkdir(to, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(new URL(file, from), new URL(file, to));
}
console.log("Copied MapLibre worker to public/maplibre/");
