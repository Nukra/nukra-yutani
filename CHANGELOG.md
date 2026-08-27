# Changelog

## v0.9.0 — 2026-08-27

First public pre-release. Fedora 44 / GNOME 47+ on Wayland.

### Added
- `ptai-theme reload` — re-render from the working copy and re-import the
  extension in place, so shell CSS, extension JS, icons and the GTK sheet apply
  without a logout.
- Icon set: 63 drawn glyphs across places, mimetypes and apps, rendered per
  preset and installed as `PTAI-<Name>`, with 75 aliases and Adwaita as the
  fallback for anything uncovered.
- Interactive panel gauges: CPU, memory, temperature, load, network, uptime and
  node name, each with a sparkline of the last four minutes and a click-through
  detail panel. One sampler reads `/proc` every two seconds for all gauges.
- Per-field gauge toggles and a bar-height control in the extension preferences.
- Extension ships its own per-preset `stylesheet.css`, so panel furniture is
  styled even with User Themes off.

### Removed
- Sound support. Event-sound coverage in GNOME was too patchy to be worth the
  weight, and per-keystroke audio is not reachable from bash without breaking
  readline. `install` tears down a previously installed PTAI sound theme.

### Fixed
- The terminal never followed a preset switch. Three causes: the rendered
  palette file was never selected in dconf; `apply_settings` then wrote a
  second, conflicting palette name over `install_terminal`'s; and the name was
  per-preset (`ptai-amber`), which a running Ptyxis has never scanned — it reads
  the palettes directory at startup and silently falls back to its own default
  when the configured palette is unknown. There is now one `ptai.palette` whose
  contents change per preset, written to the Flatpak data directory as well when
  present, and selected on every profile rather than only the default.
- Preset switches now repaint open terminal windows without a logout. The
  palette alternates between two fixed names, `ptai-a` and `ptai-b`: the new
  colours are rendered into whichever slot is not in use and the profile is
  flipped to it. Both names exist from startup, so the target is always one
  Ptyxis has scanned, and the change of selection is what makes it re-read the
  file.
- `doctor` gained three terminal checks: whether a PTAI palette is selected,
  whether its file exists, and whether its background matches the active preset.
- `set` rendered the new preset but never re-applied it to the running session:
  the extension re-import, the `user-theme` name toggle and the icon-cache
  refresh existed only in `reload`, so switching preset left the shell, panel
  and icons on the previous colours until a logout. Both commands now share a
  `repaint_session` step.
- The command reveal piped every command through the typer, so `ls`, `grep` and
  anything else using `--color=auto` saw a pipe rather than a terminal and
  dropped colour entirely — `ls -la` looked unthemed while `LS_COLORS` was
  correct. The aliases now expand `$__ptai_lscolor` at execution time and the
  reveal sets it to `always` for the duration. `ptai-colors --debug` reports
  whether the reveal is active.
- `reload` skipped `install_prompt` and `install_terminal`, so `LS_COLORS` and
  the terminal ANSI ramp were never re-rendered: role-colour changes appeared to
  do nothing. Both now run, and `reload`/`set` say that open shells need
  `exec bash`.
- `ptai-colors --debug` now stamps the preset each shell sourced and compares it
  against the file on disk, distinguishing wrong colours from a stale shell.

### Changed
- Secondary text across the shell and GTK sheets moved off `DIM` onto the
  floored `ROLE_META` token: gauge labels, detail-panel keys, quick-settings
  subtitles, calendar headings, greeter prompts, GTK dim labels, column headers
  and the Nautilus floating bar. `DIM` never cleared 4.5:1 against any preset
  background (2.0-4.1:1) and stays a hairline colour only.
- Role colours in all nine presets re-fitted to three floors: 4.5:1 against the
  background, separation from `FG` by luminance or 25 degrees of hue (relaxed
  for the bold and underlined classes, where weight is a second channel), and
  separation from every other role by 20 degrees of hue or a 1.3:1 luminance
  ratio. `ROLE_META` stays below body-text luminance so it recedes.
- Panel yield order: the gauge cluster carries the smallest minimum padding on
  the bar, so a crowded panel compresses the gauges rather than clipping the
  wordmark or the indicator group. The wordmark's 128px floor is gone.
- `--gtk` is now on by default; `--no-gtk` opts out and removes a previous
  install. GTK sheet extended to cover Nautilus and Settings.
- Top bar height 30px → 52px, adjustable 0–96px.
- Accent colour redefined at `stage` so accent-driven widgets (quick-settings
  toggles, sliders, checks, selection) follow the preset instead of stock teal.

### Added (continued)
- `ptai-theme doctor` — ten checks covering theme dir, rendered CSS, User Themes
  installed *and* enabled, theme name, extension, icons, GTK and fonts.
- 27 per-app icons (GNOME core, LibreOffice, Firefox, Emacs, Media Writer,
  NVIDIA, Document Scanner) and 75 aliases.
- `panel-clock` preference; the clock is reparented out of GNOME's centre box
  into the left group by default.
- `ptai-colors --debug` reports whether `LS_COLORS` reaches `ls`, and a prompt
  guard re-asserts it against late setters such as `/etc/profile.d/colorls.sh`.

### Fixed
- Sparklines drew nothing on GNOME 46+: `Clutter.cairo_set_source_color` was
  removed, and the exception in the repaint handler failed silently. Paint now
  falls back through `cr.setSourceColor` and raw `setSourceRGBA`.
- Gauge `DrawingArea` had no explicit size, so it never repainted.
- Gauge labels and the wordmark truncated to `CP… ME… TEM…` and
  `HELIOS-YUTAN…`: panel labels ellipsize by default and St shrinks labels
  before boxes. Ellipsize is now off with a width floor on the wordmark.
- Sparklines were bottom-anchored and read as dropped below the text; they now
  centre on the same midline.
- Gauges rendered in reverse: each insert at index 0 of the right box pushes the
  previous one further right.
- `install` checked that the User Themes schema existed but never enabled the
  extension, so setting the theme name did nothing silently.
- `reload` and `doctor` were missing from the argument allowlist.
- `/dev` listed in one colour: `bd`, `cd`, `pi`, `so` and `do` all pointed at a
  single `ROLE_DEV`. Each node type now has its own colour.
- Ice `ROLE_DIR`/`ROLE_FILE` sat too close to `FG` to read as distinct.
- An alias could clobber a drawn icon of the same name during the symlink pass.
