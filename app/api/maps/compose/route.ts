import { createCompositeMapBitmap, parseMapGridLayout } from "@/lib/minecraft-maps";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const layoutValue = searchParams.get("layout")?.trim() ?? "";

  if (layoutValue.length === 0) {
    return new Response("Missing layout query", { status: 400 });
  }

  try {
    const layout = parseMapGridLayout(layoutValue);
    const image = await createCompositeMapBitmap(layout);

    return new Response(image, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Length": String(image.byteLength),
        "Content-Type": "image/bmp",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compose maps";
    return new Response(message, { status: 400 });
  }
}
