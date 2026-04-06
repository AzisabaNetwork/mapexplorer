import { createMapBitmap, readMinecraftMap } from "@/lib/minecraft-maps";

function parseMapId(value: string) {
  const id = Number.parseInt(value, 10);
  return Number.isSafeInteger(id) && id >= 0 ? id : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = parseMapId(rawId);

  if (id === null) {
    return new Response("Invalid map id", { status: 400 });
  }

  try {
    const map = await readMinecraftMap(id);
    const image = createMapBitmap(map.colors, map.dimensions.width, map.dimensions.height);

    return new Response(image, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Length": String(image.byteLength),
        "Content-Type": "image/bmp",
      },
    });
  } catch {
    return new Response("Map not found", { status: 404 });
  }
}
