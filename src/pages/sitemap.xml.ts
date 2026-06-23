import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

export const prerender = true;

const SITE_URL = "https://atelier.ws";

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export const GET: APIRoute = async () => {
  const posts = await getCollection("blog");
  const newestPostDate = posts.reduce(
    (latest, post) =>
      post.data.updated > latest ? post.data.updated : latest,
    new Date("2026-06-20T00:00:00.000Z"),
  );

  const staticUrls = [
    { path: "/", lastmod: "2026-06-20" },
    { path: "/blog", lastmod: newestPostDate.toISOString().slice(0, 10) },
    { path: "/pricing", lastmod: "2026-06-20" },
    { path: "/privacy", lastmod: "2026-06-20" },
    { path: "/terms", lastmod: "2026-06-20" },
    { path: "/license/recover", lastmod: "2026-06-21" },
  ];

  const postUrls = posts.map((post) => ({
    path: `/blog/${post.id}`,
    lastmod: post.data.updated.toISOString().slice(0, 10),
  }));

  const entries = [...staticUrls, ...postUrls]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(
      ({ path, lastmod }) => `  <url>
    <loc>${escapeXml(new URL(path, SITE_URL).toString())}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
};
