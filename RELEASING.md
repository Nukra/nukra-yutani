# Release checklist

## Before tagging

- [ ] `shellcheck ptai-theme src/ptai-gdm-patch src/ptai-type` clean (CI runs it)
- [ ] `./ptai-theme install` on a clean user account, then log out and back in
- [ ] `./ptai-theme doctor` — all ten checks pass
- [ ] Walk all nine presets with `./ptai-theme set <preset>`, checking a mixed
      `ls`, the panel gauges, quick settings, Files and Settings. `paper` last —
      it is the one that breaks.
- [ ] Contrast floors hold: every `ROLE_*` at 4.5:1 against `BG` and separated
      from `FG` by luminance or 25 degrees of hue
- [ ] `sudo ./ptai-theme gdm` then `sudo systemctl restart gdm`; confirm
      `gdm-doctor` reports non-zero **PATCHED SHEETS**
- [ ] `sudo ./ptai-theme gdm-restore` returns the gresource byte-for-byte
      (`rpm -V gnome-shell` clean)
- [ ] `./ptai-theme uninstall` leaves nothing behind but the fonts
- [ ] `docs/index.html` matches the live system: preset colours, panel furniture,
      icon counts, command list
- [ ] README command table matches `usage()` in `ptai-theme`
- [ ] Icon and alias counts in README, CHANGELOG and `docs/index.html` all agree
      with `src/icons/`

## Tagging

- [ ] Move `CHANGELOG.md`'s working section under a `## vX.Y.Z — YYYY-MM-DD`
      heading and open a fresh `## Unreleased`
- [ ] `git tag -a vX.Y.Z -m "vX.Y.Z"` and push tags
- [ ] Draft the GitHub release from the changelog section; attach a
      `nukra-yutani-vX.Y.Z.tar.gz` so the docs' download card works
- [ ] Mark it a pre-release for any `0.x` tag

## GitHub Pages

Served from `main` → `/docs`. Set it once under **Settings → Pages**:
source *Deploy from a branch*, branch `main`, folder `/docs`. `docs/.nojekyll`
is already committed so the underscore-prefixed nothing gets eaten.

Confirm https://nukra.github.io/nukra-yutani/ renders after the first push.
