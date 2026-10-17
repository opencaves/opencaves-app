# Design system

How OpenCaves looks and behaves, for anyone adding or changing its interface.
The base is **Material Design 3** (M3): use its colour roles, type scale,
shapes and motion rather than MUI's defaults or values picked by eye. The
theme is `src/theme/Theme.jsx`; the app's own CSS variables are in
`src/theme/variables.scss`.

## Principles

- **M3 first.** A new component follows the M3 component it is (a search
  bar, a filled button, a dialog, a bottom sheet...), with the theme's
  tokens. Where M3 and MUI differ, M3 wins.
- **Light and dark, always.** Every component is checked in both schemes
  (see [Colours](#colours)).
- **Every user-facing text is translated** (en, fr, es; see [Texts](#texts)).
- **Restyling keeps what was asked.** When a component is restyled after a
  reference design, its items keep the order and grouping already asked for;
  the reference's different layout is offered as an option, not applied.

## Colours

- Colours come from the theme's **variables**: `theme.vars.*` in `sx` and
  `styled`, `var(--mui-*)` in SCSS. Never `theme.palette.*` or `theme.sys.*`
  for a colour: those are the light scheme's values, and stay light in dark
  mode. The theme's variables are `--mui-*` (not `--md-*`, an older prefix:
  a name that doesn't exist resolves to nothing, silently).
- `theme.palette.mode` always reads `light` with this theme: style the dark
  scheme with `theme.applyStyles('dark', {...})`, or in SCSS under
  `[data-mui-color-scheme='dark']`.
- The **M3 colour roles** the theme defines (`theme.vars.sys.color.*`,
  `--mui-sys-color-*`): `surface` (the page), the containers from
  `surfaceContainerLowest` (a card: white in light mode) through
  `surfaceContainerLow` (the phone's bottom sheet), `surfaceContainer`,
  `surfaceContainerHigh` (menus, popups) to `surfaceContainerHighest`;
  `primary`, `outline`, `outlineVariant` (decorative edges, dividers),
  `secondaryContainer`/`onSecondaryContainer` (the current page in the app
  bar), and the inverse roles (a snackbar). A role the theme lacks is added
  to the theme, light and dark, before it's used.
- **The app's own colours** are CSS variables named `--oc-*`
  (`variables.scss`): the page surfaces (`--oc-page-surface`, and
  `-translucent` over a background image), the app bar's, the map
  controls'. Every new one gets its dark value too.
- **No hard-coded white surfaces** (`#fff`, `rgba(255,255,255,…)`): they stay
  white in dark mode. White text over photos, satellite imagery and the dark
  app bar is fine.
- Third-party widgets keep their own colours unless restyled: Mapbox's
  popups are white until given the theme's (`Map.scss`).

## Type

- MUI's typography variants, mapped to M3's scale. A page's title uses
  `PAGE_TITLE_SX` (`src/components/pageTitle.js`); an edit form's section
  heading `formSectionHeadingProps` (`src/components/formSectionHeading.js`).
- The theme's own variants are declared in `src/theme/mui-theme.d.ts`.
- **No text under 12px** (0.75rem, M3's label medium / body small) - small
  print included (the admins' "Source: ..." line is 12px) - unless there's a
  good reason, written next to it in a comment (e.g. a count in a 16px badge).

## Shape and spacing

- Spacing in theme units (`theme.spacing`, `sx` numbers: 1 = 8px).
- Corners follow M3's shapes: extra small 4px (chips, tooltips), small 8px
  (`--oc-radius`, cards on a page: `borderRadius: 2`), large 16px (popups,
  panes), full (pills: search bars, the app bar's current page).
- **Cards on a page** use `DASHBOARD_SURFACE_SX`
  (`src/components/dashboardSurface.js`): paper on the page's surface, 8px
  corners; `DASHBOARD_LIST_SX` for a list or table clipped to them.

## Motion

- The theme's M3 tokens: durations in `theme.oc.sys.motion.duration`
  (`standard` 300ms, `emphasized` 500, `emphasizedDecelerate` 400 - things
  coming in, `emphasizedAccelerate` 200 - things leaving), easings in
  `theme.sys.motion.easing`.
- Patterns: a tab switch is M3's **shared axis X** (the panels slide the
  tabs' way, the height between them glides: `CaveMediaTabs`); a pane that
  opens beside another, the emphasized decelerate.
- Nothing moves for **reduced motion** (`prefers-reduced-motion: reduce`):
  an instant change instead.

## Icons and touch targets

- **Material Symbols, Rounded**: the `*Rounded` icons of
  `@mui/icons-material` (the app's own glyphs - the cave, the cave system -
  drawn to match).
- Icon buttons follow M3's sizes (the theme's `MuiIconButton`: small 32dp,
  medium 40dp, large 56dp), each with a **48dp touch target**; buttons side
  by side are 8dp apart. A control drawn smaller (an ×, a small link) gets
  its 48dp target from `TOUCH_TARGET_SX` (`src/components/touchTarget.js`).

## Components to reuse

- **Search fields**: `SEARCH_FIELD_SX` (`src/components/searchFieldSx.js`),
  M3's search bar: 56dp tall, fully rounded, the icon 16dp in, the text 16dp
  after it, a clear button at the end. Every search field finds its own
  records by id too (`matchesId`).
- **Add a…**: `AddButton` (outlined, a + icon), centred under its list.
- **A list page's "new" action** (a new cave, a new system): `PageFab`, the floating button.
- **A form's sections**: `FormSection`.
- **Confirmations**: the snackbar (`useSnackbar`), e.g. `app:snackbar.saved`.

## Navigation and forms

- **A full-screen view** (a viewer, a dialog shown full screen) is left with
  a **back arrow** at the top left, before its title. **A dialog** closes
  with an **×** at the top right. A dialog that goes full screen on phones
  (`fullScreen={isSmall}`) switches from the × to the back arrow there.
- **A pane's actions** (an edit pane, a form's footer) sit together at the
  bottom right: Cancel (text button), then **Save** (contained), rightmost -
  the primary action. A destructive action (Delete) goes to the far left of
  the same row (`mr: 'auto'`).
- **Saving stays on the form**: a successful Save is confirmed by the
  snackbar, and the form stays open. Only Cancel, the back arrow and Delete
  leave it. A new record's page swaps its address for the record's own
  (`navigate(..., { replace: true })`) so a second Save updates it.
- **Leaving an edit page** goes back in the history when it can, and
  replaces the entry otherwise (`leaveEditPage`), so Back never returns to
  the form just left.
- **After an in-app navigation** the focus moves to the new page's title
  (`RouteFocus`), without a focus ring; controls keep theirs.

## Links

- **An "open" or "view" link leads to the app's viewer** - a survey map:
  `/sistemas/<id>/maps/<mapId>`, a photo: its gallery - never to a stored
  file's URL, which a browser may download instead of showing (the storage
  emulator serves files as attachments). A link to the file itself only where
  downloading is the action (an "Original file" button).
- **A link opening a new tab or window** (`target="_blank"`, always with
  `rel="noopener noreferrer"`) shows Material's open-in-new icon after its
  text. One rule in `src/App.scss` draws it for every such link: never add
  an icon by hand. Links that are already an icon or a card (icon buttons,
  menu items, card areas) and the map's attribution are left out;
  `.oc-no-new-tab-icon` leaves out any other.

## CSS and class names

- **Every component carries an `oc-` class** naming it, in kebab case
  (`oc-coordinate-field`), and its parts a `--` suffix
  (`oc-coordinate-field--drag-handle`): for styling, debugging and the guided
  tours, which find their elements by these classes (`src/tours/tourSteps.js`
  - check it before renaming one).
- Custom CSS properties are prefixed `--oc-`.
- Styles go in `sx` or `styled` with the theme; SCSS for what MUI doesn't
  render (Mapbox's elements, global rules).

## The map

- Every cave keeps its own coloured pin, its system's colour: **no
  clustering** into count badges, even where pins overlap.
- The phone's result pane is a bottom sheet (`src/components/BottomSheet/`),
  sized with CSS (`100dvh`), never with `window.innerHeight`.

## Texts

- **No text in a component file**: every label, tooltip, placeholder,
  dialog text and `aria-label` is a key in `src/locales/{en,fr,es}.json`, in
  the namespace of its area, read with `useTranslation`. Yucatec Maya
  (`yua`) is partial and falls back to Spanish.
- Say **cave** and **cave system** in general places, **cenote** only for
  the Yucatán's own (a cenote's name, a cenote entrance).
- In French, *cénote* is **feminine**: *la cénote, une cénote, Nouvelle
  cénote*, and the words referring to it agree (*Sauvegardée*, *elle*).
