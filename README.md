# Personal site

Astro site deployed to GitHub Pages by [.github/workflows/astro.yml](.github/workflows/astro.yml)
on every push to `main`.

## Local development

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run preview  # serve the build
```

## Editing the content

All copy, project entries, work history and social links live in
[src/data/profile.ts](src/data/profile.ts). Everything currently in that file is
placeholder text, including the name, the email address and the project
descriptions. Replace the strings and the page updates, no layout work needed.

Images are `picsum.photos` placeholders referenced from the same data file plus
[src/components/Hero.astro](src/components/Hero.astro). Drop real images into
`public/` and point the `src` attributes at them when you have them.

## Structure

- [src/layouts/Base.astro](src/layouts/Base.astro) - document head, metadata,
  scroll-reveal script
- [src/components/](src/components/) - one file per page section
- [src/styles/global.css](src/styles/global.css) - color tokens, type scale,
  light and dark palettes

Dark mode follows the operating system setting through
`prefers-color-scheme`; both palettes are defined in `global.css`.
