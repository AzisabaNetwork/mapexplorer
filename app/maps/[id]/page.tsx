import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readMinecraftMap } from "@/lib/minecraft-maps";

function parseMapId(value: string) {
  const id = Number.parseInt(value, 10);
  return Number.isSafeInteger(id) && id >= 0 ? id : null;
}

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
}

export default async function MapDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = parseMapId(rawId);

  if (id === null) {
    notFound();
  }

  let map;

  try {
    map = await readMinecraftMap(id);
  } catch {
    notFound();
  }

  return (
    <main className="detail-layout">
      <section className="detail-panel">
        <div className="detail-copy">
          <p className="eyebrow">Single Map View</p>
          <h1>Map #{map.id}</h1>
          <p>
            <code>{`map_${map.id}.dat`}</code> の <code>data.colors</code> を{" "}
            <code>MapColor.java</code> 相当のロジックで復元したプレビューです。
          </p>
        </div>

        <div className="detail-preview">
          <Image
            alt={`Minecraft map ${map.id}`}
            height={map.dimensions.height}
            src={`/api/maps/${map.id}`}
            unoptimized
            width={map.dimensions.width}
          />
        </div>

        <div className="detail-links">
          <Link className="back-link" href="/">
            Back to gallery
          </Link>
          <a
            className="back-link"
            href={`/data/map_${map.id}.dat`}
            rel="noreferrer"
            target="_blank"
          >
            Open raw dat
          </a>
        </div>
      </section>

      <aside className="detail-sidebar">
        <dl>
          <div>
            <dt>File</dt>
            <dd>{`map_${map.id}.dat`}</dd>
          </div>
          <div>
            <dt>Dimensions</dt>
            <dd>{map.dimensions.width} x {map.dimensions.height}</dd>
          </div>
          <div>
            <dt>DataVersion</dt>
            <dd>{map.dataVersion ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Scale</dt>
            <dd>{map.metadata.scale ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Center</dt>
            <dd>
              {map.metadata.xCenter ?? "?"}, {map.metadata.zCenter ?? "?"}
            </dd>
          </div>
          <div>
            <dt>Dimension Id</dt>
            <dd>{map.metadata.dimension ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Locked</dt>
            <dd>{formatBoolean(map.metadata.locked)}</dd>
          </div>
          <div>
            <dt>Tracking</dt>
            <dd>{formatBoolean(map.metadata.trackingPosition)}</dd>
          </div>
          <div>
            <dt>Unlimited Tracking</dt>
            <dd>{formatBoolean(map.metadata.unlimitedTracking)}</dd>
          </div>
          <div>
            <dt>Frames / Banners</dt>
            <dd>{map.metadata.frames} / {map.metadata.banners}</dd>
          </div>
        </dl>
      </aside>
    </main>
  );
}
