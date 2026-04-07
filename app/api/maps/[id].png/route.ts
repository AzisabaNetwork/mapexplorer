import { createMapPng, readMinecraftMap } from "@/lib/minecraft-maps";

function parseMapId(value: string) {
  const id = Number.parseInt(value, 10);
  return Number.isSafeInteger(id) && id >= 0 ? id : null;
}

function isOgp(value: string | null) {
  return value === "true";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<Record<string, string | string[] | undefined>> },
) {
  const resolved = await params;
  const rawId = Array.isArray(resolved.id) ? resolved.id[0] : resolved.id;
  const id = parseMapId(rawId ?? "");

  if (id === null) {
    return new Response("Invalid map id", { status: 400 });
  }

  try {
    const map = await readMinecraftMap(id);
    const ogp = isOgp(new URL(request.url).searchParams.get("ogp"));
    const image = createMapPng(map.colors, map.dimensions.width, map.dimensions.height, { ogp });

    return new Response(image, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Length": String(image.byteLength),
        "Content-Type": "image/png",
      },
    });
  } catch {
    return new Response("Map not found", { status: 404 });
  }
}
