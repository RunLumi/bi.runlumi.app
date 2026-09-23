# Card migration

- Verdict: migrated
- Date: 2026-09-23
- Strategy: align the shared card composition with current shadcn slots while retaining Lumi's light paper, white-sheet, border, and shadow tokens.

## Changed

- Added `data-slot` markers, `size="default" | "sm"`, the `--card-spacing` token, `CardAction`, and `CardFooter`.
- Kept semantic section/card content and title/description elements compatible with existing screens.

## Left alone

- Existing card call sites and the Lumi palette remain unchanged.
- No new interaction behavior was introduced.

## Behavior changes

- Cards now use the compact shadcn spacing composition; callers can select the small size where needed.
- Header actions can use the new `CardAction` slot without bespoke positioning.

## Verify by hand

- Check default and small card spacing at desktop and narrow widths.
- Check a header with title, description, and action for a stable two-column alignment.
- Confirm nested text and controls remain readable against the white card surface.
