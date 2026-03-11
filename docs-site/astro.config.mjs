import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  // Workaround for zod v3/v4 conflict in the Astro SSR build.
  // See https://github.com/withastro/astro/issues/14117
  vite: {
    ssr: {
      noExternal: ["zod"],
    },
  },
  integrations: [
    starlight({
      title: "abcls",
      sidebar: [
        { label: "Getting Started", slug: "getting-started" },
        { label: "ABC Notation Basics", slug: "abc-notation-basics" },
        {
          label: "User Guide",
          items: [
            { label: "Selectors", slug: "user-guide/selectors" },
            { label: "Transforms", slug: "user-guide/transforms" },
            {
              label: "Preview and Playback",
              slug: "user-guide/preview-and-playback",
            },
            { label: "Kakoune Integration", slug: "user-guide/kakoune" },
          ],
        },
        { label: "Directives Reference", slug: "directives-reference" },
        { label: "CLI Reference", slug: "cli-reference" },
        { label: "Architecture", slug: "architecture" },
      ],
    }),
  ],
});
