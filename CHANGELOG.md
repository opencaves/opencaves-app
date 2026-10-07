# Changelog

## [1.0.0-beta-9](https://github.com/opencaves/opencaves-app/compare/v1.0.0-beta-8...v1.0.0-beta-9) (2026-10-07)

What's new shows the photos and videos added to caves, and every page section has its own link.


### Features

* **What's new: photos and videos** added to caves, by cave and day, with their thumbnails; the filters take several kinds at once; an entry opens the cave page's section (#photos, #videos) or a system's connections.
* **Section links:** every section of the cave, cave system and area pages has an anchor (#location, #access, #photos, #videos, #maps...; each area of the cave lists its own), with a # beside its title; a link to a section scrolls there once the page has loaded.
* **Smooth scrolling** on the pages (unless your system asks for less motion).
* **New cave icon:** a cave mouth with a stalactite and its water, clearer at small sizes.
* **Photo uploads** are in the audit log (Audits), with who added them; undoing one moves the photo to the trash.


### Bug Fixes

* **What's new** shows a loading placeholder shaped like the page.

## [1.0.0-beta-8](https://github.com/opencaves/opencaves-app/compare/v1.0.0-beta-7...v1.0.0-beta-8) (2026-10-07)

A search in the app bar, a What's new page, and every cave text now says where its words come from.


### Features

* **What's new** (/whats-new, in the app bar): the caves, cave systems, connections and maps people added in the app, newest first by day, with filters by kind and who added each; an entry opens what it's about (a map in its system's viewer).
* **Search in the app bar** on every page but the map: caves and cave systems as you type; on phones, a search button opens it over the bar.
* **Text sources:** each description, "Getting there", access and accessibility text says where its words come from ("Source: ..."), picked under the text in the edit forms. The guidebook's texts were rewritten in OpenCaves' own words.
* **Cave and cave system pages:** a Location card - a click copies a point's coordinates, a button gives directions (location, entrance, keys); a Videos section on the cave page, with Add videos; Add pictures and Add maps right on the pages.
* **Edit forms:** the coordinates show only those set, with an Add menu for the others; Exit instead of Save when nothing changed; the source pickers sized to their longest choice.
* **Videos:** 33 dive videos added to 30 cave entrances.
* **Lists:** each area's name stays in view as its caves scroll by.
* **Access:** the icons grouped and centred.
* **Map viewer:** natural pinch zoom and finger panning on phones.
* **Mobile app bar:** Log in and Sign up in one account menu.
* **About** opens as a dialog over the page you're on (its address still /about), with the light logo in dark mode.
* **Privacy and Terms** links on every page.
* **Languages and colours** are edited by admins only.


### Bug Fixes

* **Emptied fields are saved:** clearing a description, directions, source, access, coordinates... and saving no longer brings the old value back (cave page, map pane, system form).
* **Cave systems with a length** can be saved again ("sistema is not defined").
* **Typing coordinates** no longer drops zeros.
* **Dark mode:** teal links and buttons readable on the dark background; the splash screen's logo blends in.
* **Map pane's edit form:** margins on both sides, and a real Delete/Save/Exit bar on desktop.
* **Edit button's menu:** its labels are clickable and keep it open.
* **Find my location:** a real, translated tooltip.

## [1.0.0-beta-7](https://github.com/opencaves/opencaves-app/compare/v1.0.0-beta-6...v1.0.0-beta-7) (2026-10-06)

OpenCaves works offline - for a diver on a trip with no signal - and photos and maps open in their own galleries on the cave and cave system pages.


### Features

* **Offline editing:** changes to caves, cave systems, connections, maps and reference data are kept on the device and sync once back online, each saying so ("saved on this device", then "synced" or "couldn't save").
* **Photos and maps added offline** are kept on the device as "Waiting to upload" (with a button to cancel) and upload by themselves once the app is open on Wi-Fi; signing out with uploads waiting asks first.
* **Cave passages layer offline:** its tiles are kept as viewed and, with the Offline setting, downloaded around saved caves; a new build of the layer is downloaded again.
* **Offline hints:** a cave not saved says what's missing offline and how to keep it; a photo or map not on the device shows a "not available offline" cloud; sign-in and sign-up say they need a connection.
* **Galleries on the cave and cave system pages** (and the cave's edit page): a photo or map opens over the page, going through that page's photos or maps only, with "3 / 12" and each map's name, year and cartographers; editors keep their tools (cover photo, delete, edit map, trash).
* **Cave lists:** a cave icon before each cave, a system's line arrow on its name's first line, the map icons' labels as tooltips, the area cards outlined.
* **Forgot password?** sends a reset email, in the app's language.
* **Cave edit page:** an X deletes a photo; the back arrow and Cancel go to the cave's page; deleting a cave says so.


### Bug Fixes

* **Editors offline** keep their role when the app starts offline with an expired session.
* **Offline storage:** pictures and maps downloaded for offline use are no longer stored twice (~78 MB saved).
* **Pages with maps** no longer crash ("Picture is not defined").
* **Sign-in:** the email form's password field no longer duplicates its id.
* **Accessibility:** confirm dialogs no longer open with focus left behind the page.
* **Edit pages** have their item page's background; closing a map's Edit dialog no longer leaves the map twice in the history.

## [1.0.0-beta-6](https://github.com/opencaves/opencaves-app/compare/v1.0.0-beta-5...v1.0.0-beta-6) (2026-10-06)

Galleries in the installed app follow the phone more naturally.


### Bug Fixes

* **Galleries (installed app):** turning the phone sideways still opens a photo or map full screen, but turning it upright leaves full screen only if the turn entered it - a full screen chosen with the viewer's button stays, and one left by hand isn't undone.

## [1.0.0-beta-5](https://github.com/opencaves/opencaves-app/compare/v1.0.0-beta-4...v1.0.0-beta-5) (2026-10-06)

Search engines can now index every cave's page, and a few fixes on the map.


### Bug Fixes

* **Search engines:** a cave's page (`/caves/<id>`) was marked "noindex" once the app started, so Google left it out; it's indexable again, with its own description. A cave's place on the map (`/map/<id>`) now names that page as its canonical URL, and the sitemap lists each cave once.
* **Map:** the open cave's pin shows whatever the filters - picking a cave the filters hid (e.g. not a cenote entrance, with "Show other cenotes" off) moved the map to it with no pin.
* **Map:** the location button coloured as the map's other buttons, in both themes.

## [1.0.0-beta-4](https://github.com/opencaves/opencaves-app/compare/v1.0.0-beta-3...v1.0.0-beta-4) (2026-10-06)

The fourth beta: a welcome for first visits, Material Design 3 throughout (app bar, search bars, carousels, snackbars), better galleries on phones, faster cave lists, keyboard access everywhere, and the dashboard on translucent pages.


### Features

* **Welcome dialog** on a first visit: what OpenCaves is, an invitation to create an account and help keep the cave data complete, and the beta's notice (changes aren't permanent yet - a good time to try editing).
* **App bar** as Material Design 3's: compact items with the current page on a pill, the title in title large; a teal bar in the light theme, a surface bar in the dark one. On phones, a 64dp bar with a sign-in menu where Log in and Sign up don't fit, and a menu with the logo and a close button.
* **Search bars** as MD3's (56dp, 24dp icons), with the menu button in the map's search bar.
* **Photo and map carousels** on cave and cave system pages (phones), with a Show all pane of every item.
* **Galleries:** pan only when zoomed, double tap zooms in steps, the left and right arrow keys move between pictures, full screen when the phone turns sideways in the installed app, the back arrow first in the map viewer's bar; landscape allowed in the installed app.
* **Keyboard:** every control reachable and visibly focused.
* **Dashboard and index pages** on translucent pages over cave photos, their sections on opaque cards; loading skeletons shaped like each page.
* **Snackbars** as MD3's, in both colour schemes; a page's button moves up out of their way.
* **Cave systems' line arrow** beside their names on cave and cave system pages.
* **Lengths and depths** as whole numbers; exploration histories with lengths and depths, and who drew the map, on their own lines.
* Breadcrumbs on one line; the reference lists show their descriptions (sources too).


### Bug Fixes

* Cave lists (/caves, /sistemas) much faster to show and to search; typing fast no longer loses letters.
* An area's edit page no longer waits for all the cave data.
* Snackbars: a next one now shows after one is dismissed; a missing message text.
* The installed app's icons (most were missing from its manifest).
* Multiline fields' resize handle in their corner; reference list text no longer runs under the edit icon.
* The back arrow no longer overlaps the page's frame.

## [1.0.0-beta-3](https://github.com/opencaves/opencaves-app/compare/v1.0.0-beta-2...v1.0.0-beta-3) (2026-10-05)

The third beta: public pages for every cave, cave system and area, a landing page, a dark mode that works everywhere, the maps' cartographers credited, and cleaner explorer names.


### Features

* **Landing page** at `/`: a cave search, the map, live figures, the cave diving safety warning and disclaimer up front, a Discover strip of caves, the regions and how to contribute - in English, French and Spanish.
* **Public pages** for each cave (`/caves/<id>`: cover, area, system, location, access, description, photos, maps and exploration history), each cave system (`/sistemas/<id>`) and each area, plus the cave and cave system lists - searchable, with breadcrumbs, rendered on the server for search engines and listed in the sitemap.
* **Map credits:** a Maps section on cave and cave system pages (each map's name and year over its thumbnail, "Cartography: …" under it), and the cartographers named in the Maps tab and the map viewer.
* **Cave systems' colour as a cave diver's line cookie** beside their names.
* **Appearance setting** on the account page: Automatic, Light or Dark, kept on the device and in the account.
* **Map layer:** maps added in the app are listed "to process" for admins; more maps traced (Vaca Ha, the Taj Mahal banner), with the gold (cavern) line, and map symbols in the maps' own conventions (overlined depths, circled heights, penetrations, restrictions).
* **Panoramas:** the view on screen can be used as the thumbnail or cover.
* **Map preview zoom** around the pointer in the Edit map dialog.
* **French:** cave systems are *réseaux*, the cave divers' word.
* **App bar:** icons, the current page marked, the page's title in the bar once its heading scrolls away (phones); the phone menu groups the dashboard and About apart.
* SVG maps stored about 90% smaller.


### Bug Fixes

* **Dark mode:** pages, the dashboard and admin pages, menus, map controls, buttons and icons all follow it (many stayed light).
* A new page opens at its top, and back returns to where it was; another cave opens at the top of the details pane.
* Dragging a photo within a gallery no longer starts adding a photo.
* "Remove map" (which hid a map without deleting it) removed from the maps' menus.
* Caves without coordinates: a crossed-out map icon, and the disabled Show on the map button says why.
* Only an access item itself shows its tooltip on the cave page; bigger photos there.
* Descriptions no longer save an empty line as a literal `<br />`.
* Explorer and cartographer names unified (e.g. "B. Phillips", "Bill Phillips" → Bil Phillips).

## [1.0.0-beta-2](https://github.com/opencaves/opencaves-app/compare/v1.0.0-beta-1...v1.0.0-beta-2) (2026-10-05)

The second beta: a full security audit and its fixes, an audit log with undo and a trash for photos and maps, and more cave maps traced.


### Security

* **Database and storage rules rewritten and tracked in git:** visitors can no longer change or delete photos, deletes are admin-only (caves, sistemas, photos, maps, reference data), and every edit from the app is checked: only known fields, with their types and sizes.
* **Editor role:** never for anonymous sessions, and only with a verified email (the emailed sign-up link, Google or Microsoft).
* **Admin safeguards:** an admin can't remove their own admin role, nor anyone the last admin's; freezing an account takes effect at once.
* **Privacy:** ratings are private to their author (everyone sees each cenote's average), and a photo's uploader and original file name are no longer public.
* **Script injection closed** in the search results and in the server-rendered cave pages; the cave page no longer trusts the request's host.
* **Uploaded SVG maps are cleaned** of scripts and outside links, and a map's links can only point to the project's own storage.
* **Security headers** (anti-framing, nosniff, referrer and permissions policies, a content security policy in report-only mode).
* **Keys:** the Firebase key is restricted to the site, the Mapbox token is a restricted one of its own, and cave addresses come through a function of ours, keeping the Google key on the server.
* **Production backups:** point-in-time recovery, daily backups and delete protection.
* A vulnerable library in the Cloud Functions updated, the unused `/v1` API removed, and App Check wired in (off until a site key is set).


### Features

* **Audits (admins):** a log of every change made in the app - who, when, and each field's before and after in a GitHub-style diff - filtered by collection, author, kind of change and dates. Any change can be undone (one, several, or everything one person did since a date), with conflicts shown when the record changed since; an undo can itself be undone. Entries are kept 12 months.
* **Trash:** deleting a photo or a map moves it to the trash, from which an admin restores it or deletes it for good; a trashed cover hands the cover to another photo.
* **Videos:** the Add video dialog explains what to paste and only accepts YouTube, Vimeo and Facebook videos (their regular links now play too); each video gets a menu to edit it, or delete it (admins).
* **Maps:** the Edit map dialog at its own address, and an options menu (Edit, Delete) on each map in the viewer's list.
* **Sistemas:** an exploration history under the system tree, on a timeline, and a sticky section header.
* **Directions** from any location line (address, coordinates, key, entrance).
* **Offline:** a progress bar while a cenote downloads, and a clear "Ready offline" state.
* **Accounts:** sign-in with Microsoft; admins can freeze an account (the person is told by email).
* **Map layers (admins):** a page listing every traced map, with a switch to hide or show its drawing for everyone and its original scan beside the drawing.
* **Cave pages rendered on the server** for search engines.
* **More cave maps traced**, with Arianne lines drawn as their own continuous line, and only entrances the maps actually name as entrances.


### Bug Fixes

* PNG photos are processed again (their upload never created the photo), and photos are upright again (camera orientation applied).
* A photo deleted while its upload was finishing no longer comes back as an empty record.
* Photo viewer: no flicker between photos, the photo centred, the list following the photo shown.
* The cover picture no longer flickers, and the search bar can't stay stuck hidden on phones.
* Confirmation messages all show the green check.
* The error page's development details on their own panel.

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
