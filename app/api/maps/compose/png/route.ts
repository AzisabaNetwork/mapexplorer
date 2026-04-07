import { decodeMapGridLayout } from "@/lib/map-grid";
import { createCompositeMapPng, parseMapGridLayout } from "@/lib/minecraft-maps";

function isOgp(value: string | null) {
  return value === "true";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const encodedLayout = searchParams.get("layoutEncoded");
  const layoutValue = (
    encodedLayout ? decodeMapGridLayout(encodedLayout) : searchParams.get("layout") ?? ""
  ).trim();

  if (layoutValue.length === 0) {
    return new Response("Missing layout query", { status: 400 });
  }

  try {
    const layout = parseMapGridLayout(layoutValue);
    const image = await createCompositeMapPng(layout, {
      ogp: isOgp(searchParams.get("ogp")),
    });

    return new Response(image, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Length": String(image.byteLength),
        "Content-Type": "image/png",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compose maps";
    return new Response(message, { status: 400 });
  }
}
