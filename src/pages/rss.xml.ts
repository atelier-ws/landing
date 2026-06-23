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
  const posts = (await getCollection("blog")).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
  const lastBuildDate =
    posts[0]?.data.updated.toUTCString() ?? new Date().toUTCString();

  const items = posts
    .map((post) => {
      const url = new URL(`/blog/${post.id}`, SITE_URL).toString();
      const categories = post.data.tags
        .map((tag) => `    <category>${escapeXml(tag)}</category>`)
        .join("\n");

      return `  <item>
    <title>${escapeXml(post.data.title)}</title>
    <link>${escapeXml(url)}</link>
    <guid isPermaLink="true">${escapeXml(url)}</guid>
    <description>${escapeXml(post.data.excerpt)}</description>
    <author>contact@atelier.ws (Atelier)</author>
    <pubDate>${post.data.date.toUTCString()}</pubDate>
${categories}
  </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Atelier Blog</title>
  <link>${SITE_URL}/blog</link>
  <description>Engineering notes about coding-agent runtimes, code intelligence, context engineering, and cost.</description>
  <language>en</language>
  <lastBuildDate>${lastBuildDate}</lastBuildDate>
  <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
};
