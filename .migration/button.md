# Button migration

- Verdict: migrated
- Date: 2026-09-23
- Strategy: keep the shared Lumi button API and styles while replacing Radix Slot composition with Base UI Button.

## Changed

- `Button` now wraps `@base-ui/react/button` and accepts its native props, including `render` for composition.
- Preserved Lumi variants, sizes, focus styling, and the safe `type="button"` default.

## Left alone

- No current core call site used Radix `asChild`; no call-site rewrite was needed.
- Link navigation continues to use router links directly.

## Behavior changes

- Consumers composing non-button elements should use Base UI's `render` prop instead of `asChild`.
- Native button type defaults to `button`, so forms do not submit implicitly.

## Verify by hand

- Confirm default, outline, ghost, small, and icon variants render with theme tokens.
- Keyboard-tab to a button and activate it with Enter and Space.
- Confirm `render` composition retains focus, disabled state, and accessible name.
