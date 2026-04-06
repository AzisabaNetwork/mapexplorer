import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parse, simplify } from "prismarine-nbt";
import { getMapRgbColor } from "./map-colors";

const MAP_SIZE = 128;
const MAP_DATA_DIR = process.env.MAP_DATA_DIR ??
  path.resolve(process.cwd(), "public", ["da", "ta"].join(""));
const MAP_FILENAME_PATTERN = /^map_(\d+)\.dat$/;

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

let mapIdsPromise: Promise<number[]> | undefined;

function getMapFilePath(id: number) {
  return path.join(MAP_DATA_DIR, ["map_", String(id), ".dat"].join(""));
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

export function getAllMapIds() {
  mapIdsPromise ??= readMapIdsFromDisk();
  return mapIdsPromise;
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
  const file = await fs.readFile(getMapFilePath(id));
  const { parsed } = await parse(file);
  const simplified = simplify(parsed) as SimplifiedMapData;
  const mapData = simplified.data;

  if (!mapData?.colors || mapData.colors.length !== MAP_SIZE * MAP_SIZE) {
    throw new Error(`Invalid map colors for map_${id}.dat`);
  }

  return {
    id,
    dataVersion: simplified.DataVersion ?? null,
    dimensions: {
      width: MAP_SIZE,
      height: MAP_SIZE,
    },
    metadata: {
      banners: mapData.banners?.length ?? 0,
      dimension: mapData.dimension ?? null,
      frames: mapData.frames?.length ?? 0,
      locked: mapData.locked === 1,
      scale: mapData.scale ?? null,
      trackingPosition: mapData.trackingPosition === 1,
      unlimitedTracking: mapData.unlimitedTracking === 1,
      xCenter: mapData.xCenter ?? null,
      zCenter: mapData.zCenter ?? null,
    },
    colors: mapData.colors,
  };
}

export function createMapBitmap(colors: number[], width = MAP_SIZE, height = MAP_SIZE) {
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
      const [red, green, blue] = getMapRgbColor(colors[y * width + x] ?? 0);
      bytes[pixelOffset] = blue;
      bytes[pixelOffset + 1] = green;
      bytes[pixelOffset + 2] = red;
      bytes[pixelOffset + 3] = 0xff;
      pixelOffset += bytesPerPixel;
    }
  }

  return Buffer.from(buffer);
}
