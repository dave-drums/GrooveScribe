# Groove Lab branding audit

Branding-only update of the standalone GrooveScribe repository, prepared and verified locally on 3 November 2026. The Dave Drums website and external repositories are outside this change.

## Audit before changes

The repository-wide audit covered HTML, JavaScript, CSS, SVG metadata, image filenames, metadata, documentation, generated text, archived examples and tooling. It found 638 lines with branding, internal-name or logo references across 31 text files. Binary logo/icon assets were also inventoried. Full search results, original source snapshots and verification artifacts are in `%TEMP%/groove-lab-rebrand`.

| Category | Decision |
| --- | --- |
| Main editor logos, browser title, metadata, hidden public description | Update branding |
| About and Help headings/public copy | Update branding and reuse existing Inter font request |
| Generated browser/print title, visible warning and social-share wording | Update display strings only |
| Embedded-player browser metadata and expand-control tooltip | Update display text only |
| Classes, variables, functions, selectors, IDs, filenames and URL-format markers | Preserve |
| Original copyright/GPL notices, upstream acknowledgements and third-party licences | Preserve |
| Archived `OLD/` pages, old image files, internal source/setup documentation and tooling logs | Preserve; not enough evidence to rewrite historical/internal references |
| Unrelated `promow.html` and its lawn-care branding | Preserve |

## Files and assets

Modified existing files: `index.html`, `GrooveEmbed.html`, `gscribe_about.html`, `gscribe_help.html`, `js/groove_writer.js`, `js/groove_utils.js` and `README.md`. This report is new.

New branding assets in `images/`:

- `groove-lab-wordmark.svg` and `.png`: GROOVE LAB / BY DAVE DRUMS / Create. Play. Explore.
- `groove-lab-mark.svg` and `.png`: compact GL monogram.
- `groove-lab-icon.svg`, `groove-lab-icon-96.png`, `groove-lab-icon-192.png` and `groove-lab-apple-touch-icon.png` (180px).
- `groove-lab-social.svg` and `.png`: 1200x630 social artwork.

PNG artwork was rendered from the editable SVG sources with the existing Inter 400/600 font. No font/library dependency was added to the application. The original logo PNG dimensions (748x294 and 250x358), existing 30px/40px CSS heights, container positions and surrounding editor geometry are preserved. Original branding files remain available at their original paths.

The default browser title is `Groove Lab | Dave Drums`. Existing custom groove titles and author-derived tab titles keep their original behaviour. The About page includes: "Groove Lab is based on the open-source GrooveScribe project by Lou Montulli and Mike Johnston."

## Protected implementation

JavaScript edits are limited to the audited public-facing string literals. Exact replacement checks confirm that the rest of both edited JavaScript files is unchanged. Function/variable identifiers, HTML IDs/classes/handlers, inline scripts and external script order match the originals.

Every CSS file, third-party library, soundfont, original image, archived example, `SOURCE_CODE_README.md`, `LICENSE.txt` and `CNAME` is byte-for-byte unchanged. No file/directory was renamed. No query parameter, notation format, URL-generation code, iframe integration, domain, hosting/deployment configuration or external service endpoint was changed.

## Browser verification

Installed Microsoft Edge and temporary Playwright tooling were used; no test framework or dependency was installed in the repository.

- Compared every visible editor element's geometry at 375px, 800px and 1440px: all before/after values match.
- Verified note editing, multiple measures/removal, keyboard undo/redo, arrow/Space shortcuts, tempo, swing, metronome, presets, Web Audio playback/pause and soundfont loading.
- Compared all captured groove states, encoded share queries and SVG notation before/after: exact matches.
- Downloaded SVG, PNG and MIDI files from both versions: all matching exports have identical hashes.
- Verified shared URLs reopen the same groove and custom titles/authors retain their tab-title behaviour.
- Generated notation print popups and PDFs. No physical print job was sent.
- Verified a cross-origin editor iframe, URL-generated grooves, playback, native fullscreen and the existing compact `GrooveEmbed.html` player.
- Verified phone portrait editing and landscape playback. The application's existing 800px minimum width and surrounding sites' orientation/fullscreen implementations are unchanged.
- Verified new About/Help branding, attribution, complete image loads and existing script loads.
- No uncaught JavaScript errors, console errors or failed local script/image requests were observed. A separate before/after share-dialog console check also passed.

These checks cover Edge desktop/mobile emulation. Firefox, Safari, physical mobile devices, speakers and printers were not separately tested. No application functionality was refactored to address unrelated existing behaviour.

## Remaining GrooveScribe references and compatibility

The upstream project name remains in the required author/licensing attribution. Internal names such as `GrooveWriter`, `myGrooveWriter`, `GrooveUtils`, `fullGrooveScribe`, `midiGSLogo` and their filenames/selectors are intentionally retained. Technical/historical documentation, code comments, archived `OLD/` pages, tooling logs and original asset names also retain their references.

The legacy inline G glyph in `addInLineGScribeLogoLoneGSVG()` is an existing application-control icon, so its function and visual control remain untouched. Its tooltip now names Groove Lab; the current compact embed already hides this control. Archived examples may still display original logos.

The original dynamic Open Graph image service, short-link service and integration destinations are retained as requested. The static social-image fallback points to the new artwork under the existing `groove.davedrums.com.au` domain; externally generated content remains controlled by its existing service. No new compatibility issue was detected in the tested environment.

All changes are local only. No commit, push, deployment, repository rename, Pages/configuration change or main-website modification is part of this work.
