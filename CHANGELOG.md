# Changelog

## [1.0.0-beta-1](https://github.com/opencaves/opencaves-app/compare/v1.2.0...v1.0.0-beta-1) (2026-10-02)

The first beta of the new OpenCaves. It covers all the work since 1.2.0: the app now runs on Vite with its data in Firestore, can be edited in the app, and shows the cave passages traced from published survey maps.


### Features

* **Cave passages on the map:** the passages, water, drawn details and symbols traced from more than 60 published cave survey maps, shown as vector tiles. A layer button shows or hides them, shows every system or only the selected cenote's, and colours by system or in one colour; a legend explains the marks.
* **Map edit mode for editors:** pointing at a drawing shows which map it comes from (title and date). A drawing can be hidden for everyone, and shown again.
* **Data in Firestore, edited in the app:** caves, sistemas, connections, sources and the other reference data are edited from in-app forms (dashboard, cave and sistema pages), with unsaved-changes protection; saving stays on the form.
* **163 cenotes found on the cave maps** added, with their positions to be confirmed, cenote-entrance flags, and new sistemas and exploration histories.
* **Cenote entrances:** caves used to enter a cave system are flagged and shown.
* **Coordinates:** each one has a validity (valid, unconfirmed, invalid) shown on the map pin. A coordinate can be placed with a map cross, a place or cenote search, or "Use my location".
* **Units:** metric, imperial, or automatic by region, chosen on the account page. Depths, the legend and sistema lengths follow it.
* **Lengths in descriptions:** a length tag (`:length[45 m]`) shows each reader the length in their units (m, km, ft, yd, mi), keeping the written precision. In the editor, it's a chip edited in place; lengths typed by hand become tags.
* **Markdown editor:** a rich editor for descriptions and directions, with links to web pages or to other cenotes.
* **Languages:** English, French and Spanish, plus partial Yucatec Maya. The language is chosen on the account page.
* **Account and menus:** a reworked account page and a Google Maps–style account menu. Editors get an auto-granted role, and a script sets admin roles.
* **Ratings:** editors and admins can rate cenotes.
* **Privacy policy and Terms of service** pages.
* **SEO:** per-page titles and meta, structured data, and a sitemap.
* **Offline:** the app can be made available offline, and it prompts when an update is ready.
* **Phone:** the details sheet keeps its position on reload, and editing works on phones (coordinates, forms).


### Bug Fixes

* Links underlined in the secondary colour again, and colours, shadows and transitions that were silently missing restored (old `--md-*` CSS variables renamed to `--mui-*`).
* Reopening a cave link after moving the map flies back to its pin.
* Access icons in the detail pane have tooltips and line up with their labels.
* Markdown cave links navigate within the app instead of reloading the page.

## [1.2.0](https://github.com/opencaves/opencaves-app/compare/v1.1.0...v1.2.0) (2023-07-23)


### Features

* Detection of updates appening while the app is open ([1af8c61](https://github.com/opencaves/opencaves-app/commit/1af8c61cfa684598965295bfc4f8ac1be9223da6))


### Bug Fixes

* Long URLs in result details don't break layout ([4855b10](https://github.com/opencaves/opencaves-app/commit/4855b1039516a5de46534f2b2694bdd94b0ef854))

## [1.1.0](https://github.com/opencaves/opencaves-app/compare/v1.0.1...v1.1.0) (2023-07-20)


### Features

* **app:** New custom window title bar ([529ac6c](https://github.com/opencaves/opencaves-app/commit/529ac6c44a0a0878f5365198261eebfff3d41341))

## [1.0.1](https://github.com/opencaves/opencaves-app/compare/v1.0.0...v1.0.1) (2023-07-19)


### Bug Fixes

* Clicks where not working in the result pane on small devices ([698fd98](https://github.com/opencaves/opencaves-app/commit/698fd98704a00094b6c6982913b8c933411acd07))
* Fixed quick actions colors on hover ([b3e0194](https://github.com/opencaves/opencaves-app/commit/b3e01941c8a57a83cac6a1ec3855a017f7555c81))
* Fixed wrong primary color on the map location button ([5f998bf](https://github.com/opencaves/opencaves-app/commit/5f998bfb49be2d4a5cdbf193068bb28efeca5373))
* Hide snackbar on clipboard copy on Android devices since they use their own ([5e7ee06](https://github.com/opencaves/opencaves-app/commit/5e7ee063bb5457ca897a5de3dea8e2456e9ab94b))
* Result pane did not fill the viewport height ([7998082](https://github.com/opencaves/opencaves-app/commit/7998082c286c49dbb7b69140f81350b040e99343))

## [1.0.0](https://github.com/opencaves/opencaves-app/compare/v1.0.0...v1.0.0) (2023-07-18)


### Features

* Initial release ([136d467](https://github.com/opencaves/opencaves-app/commit/136d467d972d40b87287f3820b5769eeedbf0450))


### Bug Fixes

* Removed unused dependencies ([1b90119](https://github.com/opencaves/opencaves-app/commit/1b9011912df89e994f3553e22bbec3fb83c9f982))


### Miscellaneous Chores

* release 1.0.0 ([36ff89e](https://github.com/opencaves/opencaves-app/commit/36ff89ecb214d7dbb144da7c5084d7ecc7b9f364))
