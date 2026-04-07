import { createMapBitmap, createMapPng, readMinecraftMap } from "@/lib/minecraft-maps";

function parseMapId(value: string) {
  const normalized = value.endsWith(".png") ? value.slice(0, -4) : value;

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const id = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(id) && id >= 0 ? id : null;
}

function wantsPng(value: string) {
  return value.endsWith(".png");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = parseMapId(rawId);

  if (id === null) {
    return new Response("Invalid map id", { status: 400 });
  }

  try {
    const map = await readMinecraftMap(id);
    const png = wantsPng(rawId);
    const ogp = new URL(request.url).searchParams.get("ogp") === "true";
    const image = png
      ? createMapPng(map.colors, map.dimensions.width, map.dimensions.height, { ogp })
      : createMapBitmap(map.colors, map.dimensions.width, map.dimensions.height);

    return new Response(image, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Length": String(image.byteLength),
        "Content-Type": png ? "image/png" : "image/bmp",
      },
    });
  } catch {
    return new Response("Map not found", { status: 404 });
  }
}
