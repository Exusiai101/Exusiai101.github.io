/*
  All content on the site lives here. Everything below is placeholder copy:
  swap the strings for real details, no layout changes needed.
*/

export const profile = {
  name: "Scout Wu",
  role: "Computer Science Students",
  // Hero headline: keep it to two lines at desktop.
  headline: "I'm having fun with my work",
  // Keep the hero subtext under 20 words.
  intro:
    "I work on Web Dev , AI, and Reverse Engineering. Open to new projects.",
  about: [
    "I spent my last few month building web app and AI Agents, and I enjoyed it a lot. ",
  ],
  availability: "Free after Sep.2026",
  email: "scoutwu@outlook.com",
  resumeUrl: "#",
};

export const projects = [
  {
    name: "UWA unit map",
    summary:
      "The UWA Handbook states prerequisites as prose, one unit at a time. This scrapes all 3344 units into a dependency graph you can scope to any of its 167 majors.",
    tags: ["Astro", "Cytoscape", "TailwindCSS"],
    href: "/uwa-units/",
    image: "/uwa-units-preview.png",
    imageAlt:
      "Prerequisite graph for the Software Engineering major, showing units connected by arrows from each prerequisite to the unit it unlocks",
    feature: true,
  },
  // ,
  // {
  // 	name: "Tideline",
  // 	summary:
  // 		"Schema migration CLI that reviews a diff before it touches production.",
  // 	tags: ["Rust", "Postgres"],
  // 	href: "#",
  // 	tinted: true,
  // },
  // {
  // 	name: "Paperweight",
  // 	summary:
  // 		"Offline-first reading queue that syncs across devices without an account.",
  // 	tags: ["TypeScript", "IndexedDB"],
  // 	href: "#",
  // 	image: "https://picsum.photos/seed/paperweight-reading-desk/900/900",
  // 	imageAlt: "Placeholder photograph of an open book beside a laptop",
  // },
  // {
  // 	name: "Coldbrew",
  // 	summary:
  // 		"Small job scheduler for cron work that needs retries and an audit trail.",
  // 	tags: ["Go", "Redis"],
  // 	href: "#",
  // },
];

export const toolkit = [
  {
    group: "Languages",
    items: ["Python", "TypeScript", "Java", "C/C++", "SQL"],
  },
  {
    group: "Infrastructure",
    items: ["Postgres", "Docker", "GitHub Actions", "LangSmith"],
  },
  {
    group: "Currently learning",
    items: ["Rust", "Go"],
  },
];

export const experience = [
  {
    period: "Aug. 2026 - now",
    role: "Software engineer",
    org: "Squadrone",
    note: "Designing Drone Competition and Simulators.",
  },
  {
    period: "Jul. 2026 - Aug. 2026",
    role: "AI Engineer",
    org: "Visaigo",
    note: "Build AI agents for start up verification.",
  },
];

export const links = [
  {
    label: "LinkedIn",
    handle: "in/wenbo-wu-239501211/",
    href: "https://www.linkedin.com/in/wenbo-wu-239501211/",
    icon: "ph:linkedin-logo-bold",
  },
  {
    label: "GitHub",
    handle: "@Exusiai101",
    href: "https://github.com/Exusiai101",
    icon: "ph:github-logo-bold",
  },
  {
    label: "Email",
    handle: "scoutwu@outlook.com",
    href: "scoutwu@outlook.com",
    icon: "ph:envelope-simple-bold",
  },
  {
    label: "Bluesky",
    handle: "@you.bsky.social",
    href: "https://bsky.app/profile/you.bsky.social",
    icon: "ph:butterfly-bold",
  },
];
