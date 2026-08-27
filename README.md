# PTAI — terminal system theme

Personal-Terminal-Access-Interface. A phosphor-CRT system theme for **Fedora 44 Workstation / GNOME on Wayland**, in nine presets.

| Preset | Cast |
|---|---|
| `green` | green phosphor (default) |
| `amber` | amber phosphor |
| `ice` | cyan |
| `nostromo` | sodium yellow |
| `oxide` | warning red |
| `magnetic` | violet |
| `lithium` | cold grey |
| `p1` | high-key green |
| `paper` | light mode (`LIGHT=1` pulls back the CRT effects) |

Covers the shell, GTK apps (Files, Settings, dialogs), a drawn icon set, the terminal palette and prompt, the wallpaper, and the login screen.

Every preset is drawn out in the gallery: **[nukra.github.io/nukra-yutani/](https://nukra.github.io/nukra-yutani/)** — swatches, a panel mock, the desktop schematic and the app chrome, per preset.

![The PTAI desktop, ice preset](screenshots/desktop-ice.png)
*The `ice` preset: wallpaper wordmark, panel gauges, hazard stripe.*

## The presets

Every preset re-renders the whole system from four colours, so the difference is not a wallpaper swap — the panel gauges, icon set, terminal ramp and greeter all move with it.

### Desktop

| | | |
|:--|:--|:--|
| ![green](screenshots/desktop-green.png) `green` | ![amber](screenshots/desktop-amber.png) `amber` | ![ice](screenshots/desktop-ice.png) `ice` |
| ![nostromo](screenshots/desktop-nostromo.png) `nostromo` | ![oxide](screenshots/desktop-oxide.png) `oxide` | ![magnetic](screenshots/desktop-magnetic.png) `magnetic` |
| ![lithium](screenshots/desktop-lithium.png) `lithium` | ![p1](screenshots/desktop-p1.png) `p1` | ![paper](screenshots/desktop-paper.png) `paper` |

`paper` is the only `LIGHT=1` preset: scanlines, vignette and flicker pull back so the effects read as print texture rather than a dark CRT.

### Terminal

The login banner types itself out on every new shell, and the prompt, `LS_COLORS` ramp and Ptyxis palette all come from the same four preset colours.

![The boot banner typing out on the green preset](screenshots/term-green.gif)

<details>
<summary><b>The same banner in the other presets</b> — amber, ice, nostromo, oxide, magnetic, lithium, p1, paper</summary>

![amber](screenshots/term-amber.gif)
![ice](screenshots/term-ice.gif)
![nostromo](screenshots/term-nostromo.gif)
![oxide](screenshots/term-oxide.gif)
![magnetic](screenshots/term-magnetic.gif)
![lithium](screenshots/term-lithium.gif)
![p1](screenshots/term-p1.gif)
![paper](screenshots/term-paper.gif)

</details>

## Install

```bash
sudo dnf install gnome-shell-extension-user-theme      # required
git clone https://github.com/nukra/nukra-yutani
cd nukra-yutani
chmod +x ptai-theme
./ptai-theme install green
```

Then log out and back in. That's required once, on first install — GNOME on Wayland can't load a new shell theme or newly installed fonts in place. After that, `./ptai-theme reload` applies changes without a logout.

Three commands cover almost everything afterwards:

```bash
./ptai-theme set amber      # switch preset
./ptai-theme crt subtle     # dial the CRT effects down
./ptai-theme doctor         # something looks stock — why?
```

### Requirements

Fedora 44 Workstation / GNOME 47+ on Wayland. Nothing here is Fedora-specific except the package names and the greeter's dnf hook.

| | |
|---|---|
| `gnome-shell-extension-user-theme` | **required** — the shell theme is inert without it |
| `curl` | fonts at install time (skip with `--no-fonts`) |
| `perl-interpreter` | the command reveal; without it the prompt still works |
| `glib2`, `glib2-devel` | login screen chrome, extension schemas |
| `python3-dnf-plugins-core` | keeps the greeter themed across `gnome-shell` updates |
| `librsvg2-tools` | optional — renders the wallpaper to PNG as well as SVG |

The User Themes extension is the single most common reason the theme "doesn't apply": the panel looks right (the CRT extension styles itself) while quick settings, dash, search and app folders stay stock grey.

```bash
gnome-extensions enable user-theme@gnome-shell-extensions.gcampax.github.com
```

`install` enables it for you when it's present. If anything looks wrong, `./ptai-theme doctor` checks all ten links in the chain and names the broken one.

### Iterating

```bash
./ptai-theme reload
```

Re-renders the shell CSS, extension, icons and GTK sheet from the working copy and re-imports the extension in place — no logout. This is the loop to use while changing the theme; GTK apps still need restarting individually.

## Commands

| | |
|---|---|
| `./ptai-theme install [preset]` | install everything and apply |
| `./ptai-theme reload` | re-apply from the working copy, no logout |
| `./ptai-theme doctor` | check why the theme is not applying |
| `./ptai-theme set amber` | switch preset |
| `./ptai-theme list` | list presets |
| `./ptai-theme status` | what's installed, what's active |
| `./ptai-theme crt on` / `off` | toggle the CRT overlay |
| `./ptai-theme crt subtle\|standard\|heavy` | overlay intensity |
| `./ptai-theme crt terminal\|screen` | overlay scope — terminal windows only (default) or everything |
| `./ptai-theme uninstall` | remove it all |
| `ptai-colors` | print the file-class colour legend for the active preset |
| `ptai-colors --debug` | report whether those colours actually reach `ls` |

Any command takes a preset name as its last argument (`./ptai-theme reload amber`); without one it uses the active preset.

**Already-open shells keep the colours they started with.** `LS_COLORS` is
exported when `ptai.sh` is sourced at login, so after `set` or `reload` a
running terminal still holds the previous preset's values — `ls -la` looks
unchanged. `exec bash`, or a new terminal, picks them up.
`ptai-colors --debug` compares the shell against the file on disk and says
which of the two is stale.

The terminal palette alternates between two names, `ptai-a` and `ptai-b`.
Ptyxis only scans its palettes directory at startup, so a switch writes the new
colours into whichever slot is idle and then selects it — a name it has already
seen — which is what lets open windows repaint without a logout. If you pick a
different palette by hand in Preferences, that choice wins and switches stop
following. `./ptai-theme doctor` reports whether the selected palette matches
the active preset.

If `ls -la` is uncoloured while `ptai-colors` shows a correct legend, the cause
is usually the command reveal rather than the palette: it runs commands into a
pipe, and `--color=auto` means "only when writing to a terminal". The shipped
aliases force colour through the reveal; a hand-written `--color=auto` alias in
your own `.bashrc` will not. `ptai-type off` is the quick confirmation.

### Switches

Everything optional, and how to turn it off.

| Feature | Off | Back on |
|---|---|---|
| CRT overlay | `./ptai-theme crt off` | `crt on`, or `subtle` / `standard` / `heavy` |
| Overlay everywhere vs terminals | `crt terminal` (default) | `crt screen` |
| GTK app colours | `install --no-gtk` | `install --gtk` |
| Icon set | `install --no-icons` | `install` |
| Font download | `install --no-fonts` | `install` |
| Panel furniture — wordmark, gauges, hazard stripe, bar height, clock position | `gnome-extensions prefs ptai-crt@ptai.local` | same panel |
| Command reveal (this shell) | `ptai-type off` | `ptai-type on` |
| Command reveal (always) | `PTAI_TYPE=0` before sourcing | unset it |
| Boot banner | `PTAI_BANNER=0` | unset it |
| Login screen | `sudo ./ptai-theme gdm-restore` | `sudo ./ptai-theme gdm` |
| All of it | `./ptai-theme uninstall` | `./ptai-theme install` |

Per-value tuning lives in the extension's preferences (`gnome-extensions prefs ptai-crt@ptai.local`) or under `/org/gnome/shell/extensions/ptai-crt/` in dconf. `./ptai-theme status` prints what is currently installed and active.

### Top bar

The CRT extension dresses the GNOME panel: a 52px bar carrying a corporate wordmark at the left edge, an inverted suffix tag, the clock grouped with it, live gauges at the right, and a diagonal hazard stripe along the bottom edge.

Each gauge shows a label, its current value and a 12-sample sparkline of the last four minutes, centred on the text midline. Percentage metrics share a fixed 0–100 axis so their heights are comparable; network throughput has no ceiling, so it autoscales against the largest sample in view and reads as shape rather than magnitude. Clicking one opens a detail panel — per-metric figures, four-minute peak, process count, sample rate.

| Field | Reads | Detail panel adds |
|---|---|---|
| `cpu` | busy jiffies since last tick | load 1/5/15, processes, peak |
| `mem` | `MemAvailable` vs `MemTotal` | GB in use, swap |
| `temp` | first thermal zone | four-minute peak |
| `load` | `/proc/loadavg` | 1/5/15 minute, processes |
| `net` | rx+tx across all interfaces bar `lo` | up, down, four-minute peak |
| `up` | uptime | uptime, CPU/MEM summary |
| `node` | hostname | — |

One sampler reads `/proc` every two seconds and feeds every gauge, so gauge count costs no extra reads.

Everything here is switchable in `gnome-extensions prefs ptai-crt@ptai.local` → Top bar: per-field toggles, bar height (0–96px, 0 keeps the theme's own), clock position (left/center/right), the wordmark text (seeded from `--org`), the hazard stripe, and an "interactive gauges" switch that falls back to a single plain readout line.

Install flags: `--no-gtk` (leave GTK apps on stock Adwaita), `--no-icons` (keep Adwaita icons), `--no-fonts`, `--org "YOUR NAME"` (wallpaper wordmark). GTK and icons are on by default.

### Icons

![The app grid on the ice preset](screenshots/overview-ice.png)

63 drawn glyphs plus 75 aliases, rendered per preset into `~/.local/share/icons/PTAI-<Preset>`: folders and places, mimetypes, and named icons for the GNOME core apps, LibreOffice, Firefox, Emacs and others. Same drawing rules as the wallpaper — 1.4px strokes, mitred corners, three colours per glyph. Anything uncovered inherits Adwaita.

Apps ship icons under their own names, so adding one means drawing `src/icons/apps/<the app's icon name>.svg.in`; `aliases.txt` maps alternate names onto an existing glyph. A drawn icon always wins over an alias of the same name.

## What it touches

| Piece | Path |
|---|---|
| Shell theme | `~/.themes/PTAI-<Preset>/gnome-shell/gnome-shell.css` |
| GTK override | `~/.config/gtk-4.0/gtk.css`, `~/.config/gtk-3.0/gtk.css` |
| Icon theme | `~/.local/share/icons/PTAI-<Preset>/` |
| Wallpaper | `~/.local/share/ptai-theme/wallpaper-<preset>.svg` (+ PNG if `rsvg-convert` present) |
| Terminal palette | `~/.local/share/org.gnome.Ptyxis/palettes/ptai-<preset>.palette`, plus dconf for GNOME Terminal |
| Fonts | `~/.local/share/fonts/ptai/` |
| Prompt + aliases | `~/.local/share/ptai-theme/ptai.sh`, one sourced line in `~/.bashrc` |
| fastfetch | `~/.config/fastfetch/config.jsonc` |
| CRT overlay extension | `~/.local/share/gnome-shell/extensions/ptai-crt@ptai.local/` |
| GDM greeter settings | `/etc/dconf/db/gdm.d/95-ptai` (root only) |
| GDM greeter theme | `/usr/share/gnome-shell/gnome-shell-theme.gresource`, patched from `/usr/share/ptai-theme/gdm.css` |
| Greeter update hook | `/etc/dnf/plugins/post-transaction-actions.d/ptai-gdm.action` |
| Greeter fonts | `/usr/local/share/fonts/ptai/` |

`uninstall` reverses all of it except the font files. Run it as root (or run `sudo ./ptai-theme gdm-restore` separately) to put the stock greeter back.

![A terminal on the ice preset, showing the boot banner](screenshots/terminal-ice.png)

## Command reveal

Everything a command prints is streamed back one character at a time, the same effect as the boot banner.

Optionally the entered command is echoed first as a dim `>EXEC:` line. That is off by default — it shows the alias-expanded form (`ls` becomes `ls --color=auto`), which reads as noise next to the line you just typed. Turn it on with `ptai-type echo` or `PTAI_TYPE_ECHO=1`.

```
ptai-type            # show current settings
ptai-type off | on   # toggle the effect for this shell
ptai-type slow | normal | fast
ptai-type 0.004      # explicit seconds per character
ptai-type echo       # toggle the >EXEC: command echo (off by default)
crt <cmd>            # force the reveal on a skipped command
raw <cmd>            # run one command without it
```

Set `PTAI_TYPE=0` before sourcing to leave it off by default.

Two guards keep it usable. Long output stops revealing after `PTAI_TYPE_BUDGET` seconds (default 2.5) and dumps the rest instantly, so `cat` on a large file is not a hostage situation; Ctrl-C during a reveal skips to the end of the output rather than killing the command. Interactive programs are never filtered — editors, pagers, `top`, `ssh`, REPLs, `git`, `systemctl`, `dnf` and anything reading stdin keep the raw terminal, as does any command line containing a pipe, redirect or `&`. Extend or trim that list by editing `__ptai_type_raw` in `~/.local/share/ptai-theme/ptai.sh`.

Only the first command of a line is revealed: `a; b` types back `a` and reveals its output, then runs `b` normally. That is deliberate — the trap arms once per prompt so the shell's own prompt hooks (terminal title, vte, systemd) never get echoed.

The filter itself is `~/.local/share/ptai-theme/ptai-type`, a small perl script. ANSI escapes pass through instantly so colour survives and control codes are not spelled out. It works by rewriting each command into `{ cmd; } 2>&1 | ptai-type` from a DEBUG trap, which means stdout and stderr are merged and exit status is the filter's, not the command's — if a script depends on `$?` from the previous command, run it under `raw`.

## Login screen

Requires `glib2` and `glib2-devel` (`gresource`, `glib-compile-resources`) for the greeter chrome. Without them only the wallpaper, fonts and banner apply; `gdm-doctor` says so explicitly.

The greeter is a separate session running as the `gdm` user, so it reads none of your home directory. Theming it takes three things, all handled by `sudo ./ptai-theme gdm`:

```
sudo ./ptai-theme gdm ice        # theme the greeter with the ice preset
sudo systemctl restart gdm       # apply it (this ends your session)
sudo ./ptai-theme gdm-restore    # back to stock
sudo ./ptai-theme gdm-doctor     # why is the greeter still stock?
```

1. **Settings** — wallpaper, dark mode, fonts and the banner text land in the `gdm` dconf database.
2. **Effects** — the greeter runs no extensions, so the CRT overlay is not available there. Its static equivalent is layered in CSS instead: the wallpaper actor at the bottom, a tiled scanline over it, then a vignette SVG carrying corner falloff, a phosphor wash and a soft bloom behind the prompt. An St actor takes one background image each, hence three layers. Tune them in `src/gdm-vignette.svg.in` (opacities) and `src/scanline.svg` (line pitch).
3. **Chrome** — the greeter's stylesheet lives inside `gnome-shell-theme.gresource`, which cannot be overridden per-user. `/usr/libexec/ptai-gdm-patch` unpacks that bundle, appends `gdm.css` to every stylesheet in it, adds the scanline tile as a resource, and recompiles. It keeps a pristine copy plus a checksum stamp, so re-running always patches from stock rather than stacking overrides.
4. **Survival** — a dnf post-transaction hook re-runs the patcher whenever `gnome-shell` is updated. That needs `python3-dnf-plugins-core`; without it the greeter quietly reverts to stock on the next shell update and `sudo ./ptai-theme gdm` fixes it.

Three boot-sequence lines sit above the password prompt via `org.gnome.login-screen banner-message-text`. Change the wording in `install_gdm` in the main script — it is a plain dconf string, so `\n` separates lines.

### Iterating on the greeter

Nothing needs reinstalling to change the login screen. `/usr/share/ptai-theme/gdm.css` is the live source the patcher reads, with the preset colours already substituted:

```
sudo ./ptai-theme gdm-edit       # open that file in $EDITOR, re-patch on save
sudo ./ptai-theme gdm-reload     # re-patch after editing it by hand
./ptai-theme gdm-preview         # nested greeter, no session restart
```

Write literal colours in that file, not `@TOKENS@` — running `gdm` again regenerates it from the preset and discards hand edits. Once a change is settled, copy it back into `src/gdm.css.in` so it survives a reinstall and applies to every preset.

If the greeter comes up in stock colours, run `sudo ./ptai-theme gdm-doctor`. It reports each link in the chain and prints **PATCHED SHEETS** — the number of stylesheets inside the live gresource that carry the PTAI block. Zero means the patch never landed, in which case `sudo /usr/libexec/ptai-gdm-patch patch` names the failing step. A non-zero count with a stock-looking greeter means GDM was not restarted.

## Customising

Everything derives from four colours per preset. Edit a file in `presets/` and re-run `./ptai-theme set <preset>`:

```
BG=#04120c    window and terminal background
FG=#3ff2a8    primary text, borders, active fill
DIM=#1c7a55   borders, secondary text, inactive
HOT=#b6ffe2   highlights, cursor, clock
A0..A15       terminal ANSI palette
LIGHT=1       light preset — pulls back scanlines, glow and flicker
ROLE_*        file-class colours for ls and grep (see below)
```

`ROLE_DIR`, `ROLE_FILE`, `ROLE_EXEC`, `ROLE_LINK`, `ROLE_ARCH`, `ROLE_MEDIA`, `ROLE_DEV` and `ROLE_META` drive `LS_COLORS`. Three floors apply to every one of them: at least **4.5:1 against `BG`**; separation from `FG` by either luminance (1.4:1) or **25 degrees of hue**, relaxed to 1.18:1 for the classes `LS_COLORS` renders bold or underlined, where weight is a second channel; and separation from **each other** by 20 degrees of hue or a 1.3:1 luminance ratio. That last one is easy to miss and the most destructive: `DIR` and `FILE` are the two commonest classes in any listing, and if they converge the whole thing reads as though role colouring is off. `ROLE_META` additionally stays below body-text luminance so logs and backups recede. The FG floor is the one that bites — a role colour sitting at the same brightness and hue as the body text makes a listing look monochrome even though it is correctly coloured. `ROLE_META` also carries the shell's secondary text (gauge labels, detail keys, quick-settings subtitles, GTK dim labels), so it is worth keeping legible rather than atmospheric. Check with `ptai-colors` after editing, and `ptai-colors --debug` if the colours don't appear at all.

Add your own preset by copying `presets/green.conf` to `presets/mint.conf`, changing `KEY` and `NAME`, then `./ptai-theme set mint`.

Templates in `src/` use `@TOKEN@` placeholders substituted at install time — edit `src/gnome-shell.css.in` to change shell layout, `src/wallpaper.svg.in` for the wallpaper (swap the chevron mark for your own SVG path there), `src/ptai.sh.in` for the prompt.

## Fonts

Downloaded from Google Fonts at install, all SIL Open Font License:

- **Silkscreen** — wordmarks and headers
- **Share Tech Mono** — shell UI, titlebars, menus (set as system font at 11pt)
- **VT323** — terminal (16pt)

Use `--no-fonts` if you'd rather install your own; then change the family names in `src/gnome-shell.css.in` and the `gsettings` font lines in `ptai-theme`.

## CRT effects

Five layers, three different mechanisms:

| Effect | How |
|---|---|
| Scanlines | Live overlay pinned to terminal windows |
| Vignette / curvature | Live overlay: radial falloff, same scope as scanlines |
| Phosphor glow | `text-shadow` on shell and GTK text, dropped on inverted (selected) states where it would smear |
| Flicker | Live overlay opacity drift, irregular, ~90 ms |
| Beam sweep | A soft band of light looping down terminal windows, ~7 s per pass |
| Typewriter reveal | Terminal boot banner types out character by character |

The live layers come from a bundled GNOME extension, **PTAI CRT**, installed and enabled by `install`. By default it draws **only inside terminal windows**: one non-reactive Cairo overlay parented to each terminal's actor, so it clips to the window, follows it as you move and resize, and vanishes on minimise. Input passes straight through.

Recognised terminals are matched by window class — Ptyxis, Console, GNOME Terminal, Alacritty, kitty, WezTerm, foot, Tilix, Blackbox and others. Add your own to the `terminal-classes` key if yours is missed.

`./ptai-theme crt screen` puts the overlay back over the entire session; `crt terminal` returns it to terminals only.

Tune it three ways: `./ptai-theme crt subtle|standard|heavy`, the extension's own preferences panel (`gnome-extensions prefs ptai-crt@ptai.local`) for per-value sliders, or dconf directly under `/org/gnome/shell/extensions/ptai-crt/`.

Terminal typing speed is `PTAI_BANNER_DELAY` (default `0.004` s per character; `0` prints instantly). `PTAI_BANNER=0` skips the banner. Ctrl-C during the reveal skips to the prompt. `ptai-boot` replays it, `ptai-banner` prints it instantly.

### Cost

Scanlines and vignette repaint only on resize and settings change — effectively free once drawn. Two things run continuously: **flicker** (an opacity ease every 90 ms) and the **beam sweep** (one long linear transition per pass, cheaper than flicker since it is a single animation rather than repeated timeouts). `./ptai-theme crt subtle` turns flicker off and slows the sweep to 11 s; both have their own toggles in prefs.

## Known limits

- **No true screen curvature.** Barrel-distorting the session needs a GLSL shader over the window group, and Clutter does not distort the input region to match — your pointer would land somewhere other than where the cursor appears. The vignette with darkened corners is the honest substitute.
- **Scanlines on HiDPI** need a wider pitch or they alias into moiré. Raise `scanline-pitch` to 5–6 on a 4K panel.
- **libadwaita apps ignore themes.** `--gtk` writes `~/.config/gtk-4.0/gtk.css`, which libadwaita does read for colour definitions, but apps that hardcode their own styling will partly resist. This is a GNOME design decision, not a bug here.
- **GDM greeter theming touches root-owned files.** The patcher is reversible and stamped, but it does rewrite a package-owned gresource; `rpm -V gnome-shell` will report it as modified. `sudo ./ptai-theme gdm-restore` returns the original byte-for-byte.
- **Icon coverage is by name.** The pack draws 63 glyphs and aliases 75 more; an app whose icon name isn't listed falls through to Adwaita and keeps its full-colour icon. Adding it means drawing that name.
- The wordmark and logo mark are original placeholders. Set your own with `--org`, or replace the paths in `src/wallpaper.svg.in`.

## Contributing

Bug reports, preset submissions and icon additions all welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md). The gallery at [nukra.github.io/nukra-yutani/](https://nukra.github.io/nukra-yutani/)
is served from `docs/` on `main`; it is generated from `presets/*.conf` and
`src/icons/`, so it has to be updated in the same commit as any change to panel
furniture, role colours or the icon pack.

## Licence

MIT — see [LICENSE](LICENSE).
