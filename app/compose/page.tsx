import ComposerClient from "./composer-client";
import { parseMapGridLayout } from "@/lib/minecraft-maps";

const DEFAULT_LAYOUT = ["105, 106, 107", "108, _, 109", "110, 111, 112"].join("\n");

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolved = await searchParams;
  const layoutText = getSingleValue(resolved.layout)?.trim() || DEFAULT_LAYOUT;
  let initialCells;

  try {
    initialCells = parseMapGridLayout(layoutText).cells;
  } catch {
    initialCells = parseMapGridLayout(DEFAULT_LAYOUT).cells;
  }

  return <ComposerClient initialCells={initialCells} />;
}
