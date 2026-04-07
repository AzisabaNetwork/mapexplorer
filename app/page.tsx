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
          <p className="eyebrow">地図ギャラリー</p>
        </div>
        <dl className="hero-stats">
          <div>
            <dt>一致した件数</dt>
            <dd>{gallery.total.toLocaleString()}</dd>
          </div>
          <div>
            <dt>表示中</dt>
            <dd>{gallery.ids.length.toLocaleString()}</dd>
          </div>
          <div>
            <dt>ページ</dt>
            <dd>
              {gallery.currentPage} / {gallery.totalPages}
            </dd>
          </div>
        </dl>
      </section>

      <section className="toolbar-panel">
        <form className="toolbar-grid" action="/" method="get">
          <label className="field">
            <span>マップIDで検索</span>
            <input
              defaultValue={gallery.query}
              name="query"
              placeholder="105, 171, 400..."
              type="search"
            />
          </label>
          <label className="field">
            <span>並び替え</span>
            <select defaultValue={gallery.order} name="order">
              <option value="desc">新しい順</option>
              <option value="asc">古い順</option>
            </select>
          </label>
          <input name="page" type="hidden" value="1" />
          <button className="primary-button" type="submit">
            適用
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
            前のページ
          </Link>
          <span className="pager-label">
            ページ {gallery.currentPage} / {gallery.totalPages}
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
            次のページ
          </Link>
        </div>
        <div className="toolbar-links">
          <Link href="/compose">マップエディタを開く</Link>
        </div>
      </section>

      <section className="gallery-grid">
        {gallery.ids.map((id) => (
          <article className="map-card" key={id}>
            <a className="map-preview" href={`/maps/${id}`}>
              <Image
                alt={`地図 ${id}`}
                height={128}
                loading="lazy"
                src={`/api/maps/${id}`}
                unoptimized
                width={128}
              />
            </a>
            <div className="map-card-body">
              <div>
                <p className="map-id">地図 #{id}</p>
                <p className="map-file">{`map_${id}.dat`}</p>
              </div>
              <div className="map-actions">
                <a href={`/maps/${id}`}>詳細</a>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
