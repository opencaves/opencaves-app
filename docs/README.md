# OpenCaves documentation

How-to guides for running and maintaining OpenCaves. For how the code is
organized and its conventions, see [AGENTS.md](../AGENTS.md) at the root of
the project.

- [Design system](design-system.md): how the interface looks and behaves -
  Material Design 3 and the theme's tokens (colours, light and dark, type,
  shapes, motion, icons), the components to reuse, navigation and forms,
  links, class names, texts.
- [Maintenance](maintenance.md): checking the cave photos, syncing the
  database from the Google Sheet, user roles, Storage CORS, deploying, and
  local emulator troubleshooting, who changed what (the audit log), and the
  caves' reports and confirmations (warnings, resolving them), and the
  caves' and systems' share images (link previews, their backfill script),
  and the road distances of the caves still to confirm (OpenStreetMap, the
  monthly refresh, the manual script).
- [Keys and secrets](keys-and-secrets.md): every key, secret, token and
  credential - what it's for, who uses it, where it lives, whether it's
  public, how to replace it, and what to do if one leaks.
- [Importing cave maps](maps-import.md): bulk-import survey maps from a folder
  tree and attach them to their sistemas.
- [The cave map layer](map-layer.md): turning survey maps into placed vector
  data - processing a map, placement, tracing, symbols, and the rules for
  cenotes found on maps (unverified maps, cenote entrances, trusted positions).
- [Cave map symbols](map-symbols.md): the shared vocabulary for the symbols
  taken from the cave maps (restrictions, depths, visibility...) and each
  map author's conventions.
- [Importing cave photos](photos-import.md): bulk-import cave photos from the
  `_data` folder and attach them to their caves.
- [App Check](app-check.md): letting only the app itself use Firestore,
  Storage and the functions - registering it, watching its metrics, then
  enforcing it.
