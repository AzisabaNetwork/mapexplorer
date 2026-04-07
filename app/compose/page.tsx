import ComposerClient from "./composer-client";
import { parseMapGridLayout } from "@/lib/minecraft-maps";
import type { Metadata } from "next";
import { encodeMapGridLayout } from "@/lib/map-grid";

const DEFAULT_LAYOUT = ["105, 106, 107", "108, _, 109", "110, 111, 112"].join("\n");

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const resolved = await searchParams;
  const layoutText = getSingleValue(resolved.layout)?.trim() || DEFAULT_LAYOUT;
  const params = new URLSearchParams();
  params.set("layoutEncoded", encodeMapGridLayout(layoutText));
  params.set("ogp", "true");

  return {
    title: "Map Explorer - Composer",
    description: "地図を見るツール",
    metadataBase: new URL("https://life-mapexplorer.azisaba.net"),
    openGraph: {
      images: {
        url: `/api/maps/compose/png?${params.toString()}`,
        width: 1200,
        height: 630,
        alt: "Minecraft map composition",
        type: "image/png",
      },
    },
  };
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
