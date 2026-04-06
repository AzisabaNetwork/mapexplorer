import Image from "next/image";
import Link from "next/link";
import { listMapIds } from "@/lib/minecraft-maps";

const PAGE_SIZE = 120;

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildPageHref(page: number, order: string, query: string) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("order", order);

  if (query.length > 0) {
    params.set("query", query);
  }

  return `/?${params.toString()}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolved = await searchParams;
  const page = Number.parseInt(getSingleValue(resolved.page) ?? "1", 10);
  const order = getSingleValue(resolved.order) === "asc" ? "asc" : "desc";
  const query = (getSingleValue(resolved.query) ?? "").trim();
  const gallery = await listMapIds({
    order,
    page: Number.isFinite(page) ? page : 1,
    pageSize: PAGE_SIZE,
    query,
  });

  return (
    <main className="map-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Minecraft Map Dat Gallery</p>
          <h1>map_*.dat をそのまま眺めるためのギャラリー</h1>
          <p className="hero-text">
            <code>prismarine-nbt</code> で <code>data.colors</code> を読み、
            <code>MapColor.java</code> 相当の色計算で画像化しています。4
            万件超の地図をファイル名ベースで検索しながら見られます。
          </p>
        </div>
        <dl className="hero-stats">
          <div>
            <dt>Matches</dt>
            <dd>{gallery.total.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Showing</dt>
            <dd>{gallery.ids.length.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Page</dt>
            <dd>
              {gallery.currentPage} / {gallery.totalPages}
            </dd>
          </div>
        </dl>
      </section>

      <section className="toolbar-panel">
        <form className="toolbar-grid" action="/" method="get">
          <label className="field">
            <span>Search by map id</span>
            <input
              defaultValue={gallery.query}
              name="query"
              placeholder="105, 171, 400..."
              type="search"
            />
          </label>
          <label className="field">
            <span>Sort order</span>
            <select defaultValue={gallery.order} name="order">
              <option value="desc">Newest id first</option>
              <option value="asc">Oldest id first</option>
            </select>
          </label>
          <input name="page" type="hidden" value="1" />
          <button className="primary-button" type="submit">
            Apply
          </button>
        </form>

        <div className="pager">
          <Link
            aria-disabled={gallery.currentPage <= 1}
            className="pager-link"
            href={buildPageHref(
              Math.max(1, gallery.currentPage - 1),
              gallery.order,
              gallery.query,
            )}
          >
            Previous
          </Link>
          <span className="pager-label">
            Page {gallery.currentPage} of {gallery.totalPages}
          </span>
          <Link
            aria-disabled={gallery.currentPage >= gallery.totalPages}
            className="pager-link"
            href={buildPageHref(
              Math.min(gallery.totalPages, gallery.currentPage + 1),
              gallery.order,
              gallery.query,
            )}
          >
            Next
          </Link>
        </div>
      </section>

      <section className="gallery-grid">
        {gallery.ids.map((id) => (
          <article className="map-card" key={id}>
            <Link className="map-preview" href={`/maps/${id}`}>
              <Image
                alt={`Minecraft map ${id}`}
                height={128}
                loading="lazy"
                src={`/api/maps/${id}`}
                unoptimized
                width={128}
              />
            </Link>
            <div className="map-card-body">
              <div>
                <p className="map-id">Map #{id}</p>
                <p className="map-file">{`map_${id}.dat`}</p>
              </div>
              <div className="map-actions">
                <Link href={`/maps/${id}`}>詳細</Link>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
