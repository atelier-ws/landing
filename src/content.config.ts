import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date(),
    author: z.string(),
    excerpt: z.string(),
    image: z.string(),
    imageAlt: z.string(),
    tags: z.array(z.string()),
    category: z.enum([
      "Fundamentals",
      "Context & Memory",
      "Economics",
      "Architecture",
    ]),
    difficulty: z.enum(["Introductory", "Intermediate", "Advanced"]),
    summary: z.string().min(80),
  }),
});

export const collections = { blog };
