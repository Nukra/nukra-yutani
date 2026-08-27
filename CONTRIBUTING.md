# Contributing

Thanks for looking. This is a personal system theme, so the bar for merging is
"does it hold up across all nine presets" rather than "is it a good idea".

## Ground rules

- **Every visual change must hold up in all nine presets**, including `paper` —
  the only `LIGHT=1` preset, which pulls back the CRT effects. A change that
  looks right in `green` and muddy in `paper` is not finished.
- **`docs/index.html` mirrors the live system.** It is not decoration: the
  gallery cards, the desktop schematic and the icon sheet are generated from
  `presets/*.conf` and `src/icons/`. If you change panel furniture, role
  colouring or the icon pack, update the docs in the same commit.
- **Nothing installs outside the paths listed in the README**, and `uninstall`
  must reverse it. Anything touching root-owned files needs a stamped, reversible
  patcher — see `src/ptai-gdm-patch`.

## Setting up

```bash
git clone https://github.com/nukra/nukra-yutani
cd nukra-yutani
./ptai-theme install green
```

After the first install, iterate with:

```bash
./ptai-theme reload        # re-render from the working copy, no logout
./ptai-theme doctor        # ten-point check when something looks stock
```

GTK apps need restarting individually; the greeter has its own loop
(`sudo ./ptai-theme gdm-edit`, `gdm-reload`, `gdm-preview`).

## Colours

Everything derives from four colours per preset plus the `ROLE_*` tokens. Two
floors apply to every role colour:

- **4.5:1 against `BG`**
- separation from `FG` by luminance (1.4:1) **or** at least 25 degrees of hue —
  relaxed to 1.18:1 for the classes `LS_COLORS` renders bold or underlined
  (`di`, `ex`, `ln`, `ar`, device nodes), where weight already separates them
- separation from **every other role** by 20 degrees of hue **or** a 1.3:1
  luminance ratio

`ROLE_META` also stays below body-text luminance (above it on `LIGHT=1`
presets) so logs and backups recede rather than shout.

The second floor keeps listings from reading monochrome against the body text.
The third is the one that actually breaks things: `DIR` and `FILE` are the two
commonest classes in any listing, and if they converge the listing looks like
role colouring has stopped working entirely. `ROLE_META` also
carries the shell's secondary text — gauge labels, detail keys, quick-settings
subtitles, GTK dim labels — so it needs to stay legible rather than atmospheric.
`DIM` is a hairline colour only; it does not clear 4.5:1 in any preset and must
not be used for text.

Check your work with `ptai-colors`, and `ptai-colors --debug` if the colours
aren't reaching `ls` at all.

## Submitting a preset

Copy `presets/green.conf`, change `KEY` and `NAME`, fill in the four base
colours, the `A0`-`A15` ANSI ramp and the eight `ROLE_*` tokens. Then:

1. `./ptai-theme set <yourpreset>`
2. Check a listing (`ls` in a mixed directory), the panel gauges, quick settings
   and the login screen if you can.
3. Confirm the contrast floors above.
4. Add it to the preset table in the README and to `PRESETS` in
   `docs/index.html`.

## Adding an icon

Apps ship icons under their own names, so adding one means drawing
`src/icons/apps/<the app's icon name>.svg.in` — 24x24, 1.4px strokes, mitred
corners, at most three colours (`@FG@`, `@DIM@`, `@HOT@`) on `@BG@`.
`aliases.txt` maps alternate names onto an existing glyph, one `path<TAB>target`
per line. A drawn icon always wins over an alias of the same name.

Regenerate the docs icon sheet in the same commit — `ICONS` and `ICON_SHEET` in
`docs/index.html` are built from the files in `src/icons/`.

## Shell script style

`ptai-theme` is POSIX-ish bash targeting Fedora's `/bin/bash`. It runs under
`shellcheck` in CI. Two conventions worth keeping:

- Every `gsettings` write goes through `gset`, which skips missing schemas and
  keys instead of aborting the run — GNOME moves keys between releases.
- Anything that can fail on a stock system fails *loudly but not fatally*, with a
  line naming the package to install. `doctor` exists so that a broken install
  is one command from being diagnosed.
