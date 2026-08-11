/*
  All content on the site lives here. Everything below is placeholder copy:
  swap the strings for real details, no layout changes needed.
*/

export const profile = {
  name: 'Scout Wu',
  role: 'Software engineer',
  // Hero headline: keep it to two lines at desktop.
  headline: 'I build reliable web apps and the tools behind them.',
  // Keep the hero subtext under 20 words.
  intro:
    'I work on backend services, developer tooling, and the interfaces that sit on top. Open to new projects.',
  about: [
    'I have spent the last few years on small teams where the same person writes the migration, the API and the settings screen. That range is the part of the work I like most.',
    'Most of what I build starts as a tool I needed myself: a faster way to inspect a queue, a script that turns a spreadsheet into a schema. A few of them turned out to be useful to other people too.',
  ],
  availability: 'Taking on contract work from March.',
  email: 'you@example.com',
  resumeUrl: '#',
};

export const projects = [
  {
    name: 'Halcyon',
    summary:
      'Self-hosted metrics collector that keeps a year of service telemetry in a single SQLite file.',
    tags: ['Go', 'SQLite', 'Grafana'],
    href: '#',
    image: 'https://picsum.photos/seed/halcyon-observability-console/1200/800',
    imageAlt: 'Placeholder photograph of a desk with a monitor showing charts',
    feature: true,
  },
  {
    name: 'Tideline',
    summary: 'Schema migration CLI that reviews a diff before it touches production.',
    tags: ['Rust', 'Postgres'],
    href: '#',
    tinted: true,
  },
  {
    name: 'Paperweight',
    summary: 'Offline-first reading queue that syncs across devices without an account.',
    tags: ['TypeScript', 'IndexedDB'],
    href: '#',
    image: 'https://picsum.photos/seed/paperweight-reading-desk/900/900',
    imageAlt: 'Placeholder photograph of an open book beside a laptop',
  },
  {
    name: 'Coldbrew',
    summary: 'Small job scheduler for cron work that needs retries and an audit trail.',
    tags: ['Go', 'Redis'],
    href: '#',
  },
];

export const toolkit = [
  {
    group: 'Languages',
    items: ['TypeScript', 'Go', 'Python', 'Rust', 'SQL'],
  },
  {
    group: 'Infrastructure',
    items: ['Postgres', 'Redis', 'Docker', 'Terraform', 'GitHub Actions'],
  },
  {
    group: 'Currently learning',
    items: ['WebGPU', 'DuckDB'],
  },
];

export const experience = [
  {
    period: '2023 - now',
    role: 'Senior engineer',
    org: 'Northwind Systems',
    note: 'Rebuilt the ingestion pipeline that moves customer event data into the reporting store.',
  },
  {
    period: '2021 - 2023',
    role: 'Full-stack engineer',
    org: 'Fieldnote Labs',
    note: 'Shipped the first version of the scheduling product and the admin tooling behind it.',
  },
  {
    period: '2019 - 2021',
    role: 'Software engineer',
    org: 'Braid Interactive',
    note: 'Internal tools, build systems, and a long overdue migration off a legacy PHP monolith.',
  },
];

export const links = [
  { label: 'LinkedIn', handle: '/in/your-handle', href: 'https://www.linkedin.com/in/your-handle', icon: 'ph:linkedin-logo-bold' },
  { label: 'GitHub', handle: '@Exusiai101', href: 'https://github.com/Exusiai101', icon: 'ph:github-logo-bold' },
  { label: 'Email', handle: 'you@example.com', href: 'mailto:you@example.com', icon: 'ph:envelope-simple-bold' },
  { label: 'Bluesky', handle: '@you.bsky.social', href: 'https://bsky.app/profile/you.bsky.social', icon: 'ph:butterfly-bold' },
];
