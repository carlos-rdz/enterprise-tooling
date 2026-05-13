// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  site: "https://carlos-rdz.github.io/enterprise-tooling/",
  base: "/enterprise-tooling/",
  integrations: [
    starlight({
      title: "enterprise-coordination",
      description:
        "An open MCP collection for upstream engineering coordination.",
      logo: undefined,
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/carlos-rdz/enterprise-tooling",
        },
      ],
      editLink: {
        baseUrl:
          "https://github.com/carlos-rdz/enterprise-tooling/edit/main/docs-site/",
      },
      sidebar: [
        {
          label: "Get Started",
          items: [
            { label: "Overview", slug: "getting-started" },
            { label: "Credentials", slug: "getting-started/credentials" },
          ],
        },
        {
          label: "Concepts",
          items: [
            { label: "Why this exists", slug: "concepts/why" },
            { label: "Architecture", slug: "concepts/architecture" },
            { label: "Three operational modes", slug: "concepts/three-modes" },
          ],
        },
        {
          label: "Workflows",
          items: [
            { label: "Meeting killer", slug: "workflows/meeting-killer" },
            { label: "PM memory", slug: "workflows/pm-memory" },
            { label: "Cross-team integrator", slug: "workflows/cross-team" },
            { label: "Oncall companion", slug: "workflows/oncall-companion" },
          ],
        },
        {
          label: "MCP Servers",
          items: [
            { label: "Overview", slug: "mcp-servers" },
            { label: "pm-memory", slug: "mcp-servers/pm-memory" },
            { label: "team-registry", slug: "mcp-servers/team-registry" },
            { label: "slack", slug: "mcp-servers/slack" },
            { label: "jira", slug: "mcp-servers/jira" },
          ],
        },
        {
          label: "Gateway",
          items: [
            { label: "Overview", slug: "gateway" },
            { label: "Auth", slug: "gateway/auth" },
            { label: "Audit log", slug: "gateway/audit-log" },
          ],
        },
        {
          label: "Evals & Quality",
          items: [
            { label: "Overview", slug: "evals" },
            { label: "Writing eval cases", slug: "evals/writing-cases" },
          ],
        },
        {
          label: "Hooks",
          items: [
            { label: "Overview", slug: "hooks" },
            { label: "Jira write gate", slug: "hooks/jira-write-gate" },
            { label: "Secret scanner", slug: "hooks/secret-scanner" },
          ],
        },
        {
          label: "Guides",
          items: [
            {
              label: "Adding an MCP server",
              slug: "guides/adding-an-mcp-server",
            },
            { label: "Observability", slug: "guides/observability" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Changelog", slug: "reference/changelog" },
            { label: "Contributing", slug: "reference/contributing" },
            { label: "Security", slug: "reference/security" },
            {
              label: "Landscape research",
              slug: "reference/landscape-research",
            },
          ],
        },
      ],
    }),
  ],
});
