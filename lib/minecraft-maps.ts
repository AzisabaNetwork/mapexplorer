import "server-only";
import { Buffer } from "node:buffer";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { read } from "nbtify";
import { getMapRgbColor } from "./map-colors";

const MAP_SIZE = 128;
const MAP_DATA_DIR = process.env.MAP_DATA_DIR ??
  path.resolve(process.cwd(), "public", ["da", "ta"].join(""));
const MAP_FILENAME_PATTERN = /^map_(\d+)\.dat$/;
type MinecraftMapBucket = NonNullable<CloudflareEnv["MINECRAFT_MAP_R2_BUCKET"]>;

type SimplifiedMapData = {
  DataVersion?: number;
  data?: {
    banners?: unknown[];
    colors?: number[];
    dimension?: number | string;
    frames?: unknown[];
    locked?: number;
    scale?: number;
    trackingPosition?: number;
    unlimitedTracking?: number;
    xCenter?: number;
    zCenter?: number;
  };
};

export type MinecraftMap = {
  id: number;
  dataVersion: number | null;
  dimensions: {
    width: number;
    height: number;
  };
  metadata: {
    banners: number;
    dimension: number | string | null;
    frames: number;
    locked: boolean;
    scale: number | null;
    trackingPosition: boolean;
    unlimitedTracking: boolean;
    xCenter: number | null;
    zCenter: number | null;
  };
  colors: number[];
};

export type MapGridLayout = {
  cells: Array<Array<number | null>>;
  columns: number;
  rows: number;
};

const mapIdsPromiseBySource = new Map<string, Promise<number[]>>();

function getMapFilePath(id: number) {
  return path.join(MAP_DATA_DIR, ["map_", String(id), ".dat"].join(""));
}

async function getMinecraftMapBucket() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.MINECRAFT_MAP_R2_BUCKET;
  } catch {
    return undefined;
  }
}

async function readMapIdsFromDisk() {
  const entries = await fs.readdir(MAP_DATA_DIR, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const match = entry.name.match(MAP_FILENAME_PATTERN);
      return match ? Number(match[1]) : null;
    })
    .filter((id): id is number => id !== null)
    .sort((left, right) => left - right);
}

async function readMapIdsFromR2(bucket: MinecraftMapBucket) {
  const ids: number[] = [];
  let cursor: string | undefined;

  do {
    const listing = await bucket.list({
      cursor,
      limit: 1000,
      prefix: "map_",
    });

    ids.push(
      ...listing.objects
        .map((object: { key: string }) => {
          const match = object.key.match(MAP_FILENAME_PATTERN);
          return match ? Number(match[1]) : null;
        })
        .filter((id: number | null): id is number => id !== null),
    );

    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);

  ids.sort((left, right) => left - right);
  return ids;
}

async function readMapDatFile(id: number) {
  const bucket = await getMinecraftMapBucket();

  if (bucket) {
    const object = await bucket.get(`map_${id}.dat`);

    if (!object) {
      throw new Error(`Map map_${id}.dat not found in R2`);
    }

    return Buffer.from(await object.arrayBuffer());
  }

  return fs.readFile(getMapFilePath(id));
}

export async function getAllMapIds() {
  const bucket = await getMinecraftMapBucket();
  const sourceKey = bucket ? "r2" : "disk";
  const existingPromise = mapIdsPromiseBySource.get(sourceKey);

  if (existingPromise) {
    return existingPromise;
  }

  const nextPromise = bucket ? readMapIdsFromR2(bucket) : readMapIdsFromDisk();
  mapIdsPromiseBySource.set(sourceKey, nextPromise);
  return nextPromise;
}

export async function listMapIds(options?: {
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  query?: string;
}) {
  const order = options?.order ?? "desc";
  const query = options?.query?.trim() ?? "";
  const pageSize = Math.max(1, options?.pageSize ?? 120);
  const page = Math.max(1, options?.page ?? 1);
  const allIds = await getAllMapIds();

  const filtered = query.length === 0
    ? allIds
    : allIds.filter((id) => String(id).includes(query));

  const sorted = order === "asc" ? filtered : [...filtered].reverse();
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const ids = sorted.slice(startIndex, startIndex + pageSize);

  return {
    currentPage,
    ids,
    order,
    pageSize,
    query,
    total,
    totalPages,
  };
}

export async function readMinecraftMap(id: number): Promise<MinecraftMap> {
  const file = await readMapDatFile(id);
  const parsed = await read(file, { compression: "gzip", endian: "big" });
  const simplified = parsed.data as SimplifiedMapData;
  const mapData = simplified.data;
  const colors = mapData?.colors ? Array.from(mapData.colors) : undefined;

  if (!colors || colors.length !== MAP_SIZE * MAP_SIZE) {
    throw new Error(`Invalid map colors for map_${id}.dat`);
  }

  const metadata = mapData;

  return {
    id,
    dataVersion: simplified.DataVersion ?? null,
    dimensions: {
      width: MAP_SIZE,
      height: MAP_SIZE,
    },
    metadata: {
      banners: metadata?.banners?.length ?? 0,
      dimension: metadata?.dimension ?? null,
      frames: metadata?.frames?.length ?? 0,
      locked: metadata?.locked === 1,
      scale: metadata?.scale ?? null,
      trackingPosition: metadata?.trackingPosition === 1,
      unlimitedTracking: metadata?.unlimitedTracking === 1,
      xCenter: metadata?.xCenter ?? null,
      zCenter: metadata?.zCenter ?? null,
    },
    colors,
  };
}

export function createMapBitmap(colors: number[], width = MAP_SIZE, height = MAP_SIZE) {
  return createBitmap(width, height, (x, y) => getMapRgbColor(colors[y * width + x] ?? 0));
}

function createBitmap(
  width: number,
  height: number,
  getPixel: (x: number, y: number) => readonly [number, number, number],
) {
  const bytesPerPixel = 4;
  const pixelArraySize = width * height * bytesPerPixel;
  const fileHeaderSize = 14;
  const dibHeaderSize = 40;
  const fileSize = fileHeaderSize + dibHeaderSize + pixelArraySize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint8(0, 0x42);
  view.setUint8(1, 0x4d);
  view.setUint32(2, fileSize, true);
  view.setUint32(10, fileHeaderSize + dibHeaderSize, true);

  view.setUint32(14, dibHeaderSize, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 32, true);
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);

  let pixelOffset = fileHeaderSize + dibHeaderSize;

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue] = getPixel(x, y);
      bytes[pixelOffset] = blue;
      bytes[pixelOffset + 1] = green;
      bytes[pixelOffset + 2] = red;
      bytes[pixelOffset + 3] = 0xff;
      pixelOffset += bytesPerPixel;
    }
  }

  return Buffer.from(buffer);
}

export function parseMapGridLayout(input: string) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error("Layout is empty");
  }

  const cells = lines.map((line) =>
    line
      .split(/[\s,|]+/)
      .filter((token) => token.length > 0)
      .map((token) => {
        if (token === "_" || token === "." || token === "-") {
          return null;
        }

        const id = Number.parseInt(token, 10);

        if (!Number.isSafeInteger(id) || id < 0) {
          throw new Error(`Invalid map id "${token}" in layout`);
        }

        return id;
      }),
  );

  const columns = Math.max(...cells.map((row) => row.length));

  if (columns === 0) {
    throw new Error("Layout has no cells");
  }

  const normalized = cells.map((row) => {
    const nextRow = [...row];

    while (nextRow.length < columns) {
      nextRow.push(null);
    }

    return nextRow;
  });

  return {
    cells: normalized,
    columns,
    rows: normalized.length,
  } satisfies MapGridLayout;
}

export async function createCompositeMapBitmap(layout: MapGridLayout) {
  const uniqueIds = [...new Set(layout.cells.flat().filter((id): id is number => id !== null))];
  const loadedMaps = await Promise.all(
    uniqueIds.map(async (id) => [id, await readMinecraftMap(id)] as const),
  );
  const mapsById = new Map(loadedMaps);
  const width = layout.columns * MAP_SIZE;
  const height = layout.rows * MAP_SIZE;

  return createBitmap(width, height, (x, y) => {
    const column = Math.floor(x / MAP_SIZE);
    const row = Math.floor(y / MAP_SIZE);
    const mapId = layout.cells[row]?.[column] ?? null;

    if (mapId === null) {
      return [236, 230, 220] as const;
    }

    const map = mapsById.get(mapId);

    if (!map) {
      return [160, 60, 60] as const;
    }

    const localX = x % MAP_SIZE;
    const localY = y % MAP_SIZE;
    return getMapRgbColor(map.colors[localY * MAP_SIZE + localX] ?? 0);
  });
}
