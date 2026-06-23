import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Blog posts are authored as markdown files in src/content/blog/.
// Drop a new .md file in there and it shows up on /blog automatically.
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    excerpt: z.string(),
  }),
});

export const collections = { blog };
