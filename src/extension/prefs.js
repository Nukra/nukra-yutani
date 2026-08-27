import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function slider(group, settings, key, title, subtitle, min, max, step, digits) {
    const row = new Adw.ActionRow({title, subtitle});
    const scale = new Gtk.Scale({
        adjustment: new Gtk.Adjustment({lower: min, upper: max, step_increment: step}),
        digits,
        draw_value: true,
        value_pos: Gtk.PositionType.RIGHT,
        hexpand: true,
        width_request: 240,
        valign: Gtk.Align.CENTER,
    });
    scale.set_value(digits === 0 ? settings.get_int(key) : settings.get_double(key));
    scale.connect('value-changed', s => {
        digits === 0
            ? settings.set_int(key, Math.round(s.get_value()))
            : settings.set_double(key, s.get_value());
    });
    row.add_suffix(scale);
    group.add(row);
}

function radio(group, settings, key, title, subtitle, values) {
    const row = new Adw.ComboRow({
        title, subtitle,
        model: Gtk.StringList.new(values),
        selected: Math.max(0, values.indexOf(settings.get_string(key))),
    });
    row.connect('notify::selected', r => settings.set_string(key, values[r.selected]));
    group.add(row);
    return row;
}

function toggle(group, settings, key, title, subtitle) {
    const row = new Adw.ActionRow({title, subtitle});
    const sw = new Gtk.Switch({active: settings.get_boolean(key), valign: Gtk.Align.CENTER});
    settings.bind(key, sw, 'active', 0);
    row.add_suffix(sw);
    row.activatable_widget = sw;
    group.add(row);
}

function spin(group, settings, key, title, subtitle, min, max, step) {
    const row = new Adw.ActionRow({title, subtitle});
    const sb = new Gtk.SpinButton({
        adjustment: new Gtk.Adjustment({lower: min, upper: max, step_increment: step}),
        valign: Gtk.Align.CENTER,
        numeric: true,
    });
    settings.bind(key, sb, 'value', 0);
    row.add_suffix(sb);
    row.activatable_widget = sb;
    group.add(row);
    return row;
}

const STAT_FIELDS = [
    ['cpu', 'CPU', 'Utilisation, with load average and peak in the popup'],
    ['mem', 'Memory', 'Percentage used; popup shows GB in use and swap'],
    ['temp', 'Temperature', 'First thermal zone, with the four-minute peak'],
    ['load', 'Load average', '1 / 5 / 15 minute figures and process count'],
    ['net', 'Network', 'Up and down throughput across all interfaces'],
    ['up', 'Uptime', 'Hours and minutes since boot'],
    ['node', 'Node name', 'Hostname, uppercased'],
];

function fieldToggles(group, settings) {
    const key = 'panel-readout-fields';
    for (const [id, title, subtitle] of STAT_FIELDS) {
        const row = new Adw.ActionRow({title, subtitle});
        const sw = new Gtk.Switch({
            active: settings.get_strv(key).includes(id),
            valign: Gtk.Align.CENTER,
        });
        sw.connect('notify::active', s => {
            const on = new Set(settings.get_strv(key));
            s.active ? on.add(id) : on.delete(id);
            // canonical order, so the bar reads the same however they are toggled
            settings.set_strv(key, STAT_FIELDS.map(f => f[0]).filter(f => on.has(f)));
        });
        row.add_suffix(sw);
        row.activatable_widget = sw;
        group.add(row);
    }
}

function entry(group, settings, key, title, subtitle) {
    const row = new Adw.EntryRow({title});
    row.text = settings.get_string(key);
    row.connect('changed', r => settings.set_string(key, r.text));
    if (subtitle)
        row.set_tooltip_text(subtitle);
    group.add(row);
}

export default class PtaiCrtPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();

        const scope = new Adw.PreferencesGroup({
            title: 'Scope',
            description: 'Where the CRT overlay is drawn. Input always passes through.',
        });
        const targets = ['terminal', 'screen'];
        const targetRow = new Adw.ComboRow({
            title: 'Apply to',
            subtitle: 'Terminal windows only, or the entire session',
            model: Gtk.StringList.new(['Terminal windows', 'Whole screen']),
            selected: Math.max(0, targets.indexOf(settings.get_string('target'))),
        });
        targetRow.connect('notify::selected', r => settings.set_string('target', targets[r.selected]));
        scope.add(targetRow);
        page.add(scope);

        const screen = new Adw.PreferencesGroup({
            title: 'Screen',
        });
        slider(screen, settings, 'scanline-opacity', 'Scanlines', 'Darkness of the gaps between lines', 0, 0.8, 0.01, 2);
        slider(screen, settings, 'scanline-pitch', 'Scanline pitch', 'Pixels per line pair — raise this on HiDPI', 2, 12, 1, 0);
        slider(screen, settings, 'vignette-opacity', 'Vignette', 'Edge falloff, stands in for glass curvature', 0, 1, 0.01, 2);
        page.add(screen);

        const phos = new Adw.PreferencesGroup({title: 'Phosphor'});
        slider(phos, settings, 'tint-opacity', 'Wash strength', 'Colour cast over everything', 0, 0.3, 0.01, 2);
        const colorRow = new Adw.ActionRow({title: 'Wash colour'});
        const rgba = new Gdk.RGBA();
        rgba.parse(settings.get_string('tint-color'));
        const btn = new Gtk.ColorButton({rgba, valign: Gtk.Align.CENTER});
        colorRow.add_suffix(btn);
        phos.add(colorRow);
        btn.connect('color-set', b => {
            const c = b.get_rgba();
            const hex = '#' + [c.red, c.green, c.blue]
                .map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
            settings.set_string('tint-color', hex);
        });
        toggle(phos, settings, 'flicker-enabled', 'Flicker', 'Mains-hum brightness drift');
        slider(phos, settings, 'flicker-depth', 'Flicker depth', 'Keep low — this repaints every 90ms', 0, 0.3, 0.01, 2);
        page.add(phos);

        const sweep = new Adw.PreferencesGroup({
            title: 'Beam sweep',
            description: 'A band of light travelling down the window, as on the login screen.',
        });
        toggle(sweep, settings, 'sweep-enabled', 'Sweep', 'One continuous pass, looping');
        slider(sweep, settings, 'sweep-opacity', 'Brightness', 'Raise until you can see it, then back off a notch', 0, 0.6, 0.01, 2);
        slider(sweep, settings, 'sweep-height', 'Band height', 'Pixels', 20, 600, 10, 0);
        slider(sweep, settings, 'sweep-duration', 'Pass duration', 'Milliseconds per pass — longer is calmer', 1000, 30000, 500, 0);
        page.add(sweep);

        const bar = new Adw.PreferencesGroup({
            title: 'Top bar',
            description: 'Corporate furniture bolted onto the GNOME panel. Colours come from the shell theme, so they follow the active preset.',
        });
        toggle(bar, settings, 'panel-wordmark', 'Wordmark', 'Organisation name at the left edge');
        entry(bar, settings, 'panel-org', 'Organisation');
        entry(bar, settings, 'panel-subtitle', 'Suffix', 'Inverted tag beside the wordmark — blank to hide');
        toggle(bar, settings, 'panel-readout', 'System readout', 'Live statistics at the right edge');
        toggle(bar, settings, 'panel-stats', 'Interactive gauges', 'Sparkline per statistic, click for detail. Off gives one plain text line.');
        spin(bar, settings, 'panel-height', 'Bar height', 'Pixels. 0 keeps the shell theme height (52px).', 0, 96, 2);
        radio(bar, settings, 'panel-clock', 'Clock position', 'Left groups it with the wordmark, as the PTAI layout intends.', ['left', 'center', 'right']);
        toggle(bar, settings, 'panel-hazard', 'Hazard stripe', 'Diagonal stripe along the bottom edge of the bar');
        page.add(bar);

        const stats = new Adw.PreferencesGroup({
            title: 'Readout fields',
            description: 'Which statistics appear, sampled every two seconds from /proc.',
        });
        fieldToggles(stats, settings);
        page.add(stats);

        window.add(page);
    }
}
