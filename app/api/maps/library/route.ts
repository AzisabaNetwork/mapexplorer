import { listMapIds } from "@/lib/minecraft-maps";

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(searchParams.get("pageSize"), 48), 96);
  const query = searchParams.get("query")?.trim() ?? "";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const result = await listMapIds({ order, page, pageSize, query });

  return Response.json(result);
}
