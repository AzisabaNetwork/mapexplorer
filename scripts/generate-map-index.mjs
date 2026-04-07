import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const dataDir = path.join(projectRoot, "public", "data");
const outputPath = path.join(dataDir, "map-index.json");
const filePattern = /^map_(\d+)\.dat$/;

const entries = await readdir(dataDir, { withFileTypes: true });
const ids = entries
  .filter((entry) => entry.isFile())
  .map((entry) => {
    const match = entry.name.match(filePattern);
    return match ? Number(match[1]) : null;
  })
  .filter((id) => Number.isSafeInteger(id) && id !== null)
  .sort((left, right) => left - right);

await writeFile(outputPath, `${JSON.stringify({ ids })}\n`, "utf8");

console.log(`Wrote ${ids.length} ids to ${outputPath}`);
