# Frontend design system

## Typography

- **Page title:** `<Typography component="h1" variant="h4">` — one per page for a11y.
- **Section title:** `variant="h5"` or `variant="h6"`; card titles use `h6`.
- **Body/secondary:** `variant="body2"` with `color="text.secondary"` for descriptions.
- Use theme scale; avoid inline `fontWeight` unless overriding (theme sets h4–h6 to 600).

## Spacing

- Base unit: theme default 8px (`theme.spacing(1)`).
- Page: title `mb: 1`, description `mb: 2` or `mb: 3`, sections `mb: 3` or `mb: 4`.
- Modals: action row `mt: 2`, `gap: 1`, `justifyContent: "flex-end"`.
- Use `sx` with theme spacing; avoid inline `style` for layout/gaps.
- See `src/shared/constants/layout.ts` for semantic tokens.

## Buttons

- Primary action: `variant="contained"`.
- Destructive: `color="error"` + `variant="contained"`.
- Cancel/secondary: default (text) or `variant="outlined"`.
- Order: Cancel left, primary right. Consistent `gap: 1` in action rows.

## Modals

- Use shared modal store and `ModalWrapper`; no inline `style` in modal content.
- Action row: `Box` + `display: "flex"`, `gap: 1`, `justifyContent: "flex-end"`, `mt: 2`.

## Empty state & loading

- **EmptyState** (`shared/components/EmptyState`): use when a list or section has no items. Props: `icon`, `title`, `description`, `actionLabel`, `onAction`, `bordered`, `compact`. Use `bordered` for card-like separation.
- **LoadingState** (`shared/components/LoadingState`): centered spinner + optional label for list/content loading. Props: `label`, `minHeight`. Prefer over ad-hoc skeletons when a single block is enough; use skeletons for inline table/list rows.

## Page structure (element order)

- **Order:** Breadcrumbs (if any) → Page title (h1) → Description (optional) → Actions / filters → Main content.
- **One h1 per page:** Use `<Typography component="h1" variant="h4">` for the main page heading.
- **Section titles:** Use `variant="h5"` or `variant="h6"` with `component="h2"` for card/section headings.
- **Containers:** `Container maxWidth="lg"` (or `xl`) with `py: 2`–`py: 4`; Settings use `SettingsPageWrapper`.

## Layout

- **StandardPageLayout** (adapted from pamera-ui): use for consistent breadcrumbs strip, title + description + actions row, optional filterBar, content, optional pagination. Import from `shared/components/Layout`. Props: `breadcrumbs`, `title`, `description`, `actions`, `filterBar`, `children`, `pagination`, `fullWidth`, `sx`.
- Content pages: `Container maxWidth="lg"` and `py: 4` unless the page needs different width.
- Settings sub-pages: use `SettingsPageWrapper` (includes sub-nav and container).

## Accessibility

- One visible `h1` per route (use `component="h1"` with `variant="h4"`).
- Icon-only buttons: `aria-label`.
- Modal: `aria-labelledby`, `aria-modal`, focus management (handled in `ModalWrapper`).
