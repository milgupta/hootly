# DECISIONS.md — unspecified choices, one line each

- Package manager: npm (repo had no lockfile; npm ships with Node, zero setup).
- Scaffold: manual (not create-next-app) because repo already contained CLAUDE.md/.claude which the CLI refuses; same resulting layout.
- No `.env.local` present at build time → ALL external keys missing; per rule 4 every integration is fully built and only the outermost call is stubbed behind `// TODO(key-needed)` guards (see BUILD_REPORT.md for the list).
- Tailwind v4 tokens: mapped docs/03 §9 CSS vars into `@theme` as `--color-*`/`--radius-*`/`--shadow-*` names so Tailwind utilities (`bg-primary`, `rounded-card`, `shadow-xs`) resolve to spec values.
- Inter loaded via next/font/google with `--font-inter` variable (spec: Inter variable via next/font); JetBrains Mono left as CSS stack fallback (no code-heavy surfaces at launch).
- Typography scale exposed as `.text-h1`-style utility classes in globals.css (docs/03 §2 sizes) rather than Tailwind font-size theme to keep line-height/weight/tracking bundled per spec row.
