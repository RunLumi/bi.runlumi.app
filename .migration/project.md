# Project migration

- Verdict: migrated
- Date: 2026-09-23
- Strategy: preserve the Lumi shadcn design system and move interactive primitives from Radix UI to Base UI.

## Changed

- Shared Button uses Base UI; Card follows current shadcn slot/size composition.
- `cn` now comes from the shadcn `cn` package; app and starter configuration use `base-nova` and Tabler icons.
- Released coordinated core packages as 0.1.5 with Base UI as a direct UI-package dependency.
- Updated starter customer package metadata, generated lock, package creation checks, and version-aware Worker checks.

## Left alone

- Tailwind v4, Geist, Lumi semantic colors, application routes, and the existing core/customer ownership boundary.
- App-specific Radix components remain in customer repositories for their own migration.

## Behavior changes

- Consumers of shared Button composition use Base UI `render`; there are no existing core `asChild` call sites.
- `shadcn/tailwind.css` is imported by app and customer stylesheets, not by the workspace package root.

## Verify by hand

- Run `npm run check` and `npm run build:web`.
- Inspect Button keyboard/focus behavior and Card spacing in the built web application.
- Generate a customer starter and confirm its lock resolves exact 0.1.5 package tarballs.
