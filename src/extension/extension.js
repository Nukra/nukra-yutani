import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';
import Cairo from 'gi://cairo';
import Pango from 'gi://Pango';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import GObject from 'gi://GObject';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// One sampler feeds every gauge, so N gauges still cost one read of /proc per
// tick. Each metric keeps a short ring of samples for the sparklines.
const HISTORY = 48;

class Sampler {
    constructor() {
        this.history = {cpu: [], mem: [], temp: [], load: [], net: []};
        this.value = {};
        this._cpuPrev = null;
        this._netPrev = null;
        this.sample();
    }

    _read(path) {
        try {
            const [ok, bytes] = GLib.file_get_contents(path);
            return ok ? new TextDecoder().decode(bytes) : '';
        } catch (e) {
            return '';
        }
    }

    _push(k, v) {
        const h = this.history[k];
        h.push(v);
        if (h.length > HISTORY)
            h.shift();
    }

    sample() {
        // cpu: busy vs total jiffies since the previous tick
        const stat = this._read('/proc/stat').split('\n')[0].trim().split(/\s+/).slice(1).map(Number);
        if (stat.length > 3) {
            const total = stat.reduce((a, b) => a + b, 0);
            const idle = stat[3] + (stat[4] || 0);
            if (this._cpuPrev) {
                const dt = total - this._cpuPrev.total;
                const di = idle - this._cpuPrev.idle;
                this.value.cpu = dt > 0 ? Math.max(0, Math.min(100, Math.round((1 - di / dt) * 100))) : 0;
            } else {
                this.value.cpu = 0;
            }
            this._cpuPrev = {total, idle};
            this._push('cpu', this.value.cpu);
        }

        const mi = this._read('/proc/meminfo');
        const kb = k => {
            const m = mi.match(new RegExp(`^${k}:\\s+(\\d+)`, 'm'));
            return m ? parseInt(m[1], 10) : 0;
        };
        const memTotal = kb('MemTotal');
        const memAvail = kb('MemAvailable');
        if (memTotal) {
            this.value.memPct = Math.round((1 - memAvail / memTotal) * 100);
            this.value.memUsedGb = ((memTotal - memAvail) / 1048576).toFixed(1);
            this.value.memTotalGb = (memTotal / 1048576).toFixed(1);
            this.value.swapPct = kb('SwapTotal')
                ? Math.round((1 - kb('SwapFree') / kb('SwapTotal')) * 100) : 0;
            this._push('mem', this.value.memPct);
        }

        const la = this._read('/proc/loadavg').trim().split(/\s+/);
        if (la.length > 2) {
            this.value.load = [la[0], la[1], la[2]];
            this.value.procs = la[3] || '';
            this._push('load', Math.min(100, parseFloat(la[0]) * 25));
        }

        let raw = this._read('/sys/class/thermal/thermal_zone0/temp').trim();
        if (!raw)
            raw = this._read('/sys/class/hwmon/hwmon0/temp1_input').trim();
        if (raw) {
            this.value.temp = Math.round(parseInt(raw, 10) / 1000);
            this._push('temp', Math.min(100, this.value.temp));
        }

        // net: summed rx+tx across every interface bar loopback. Stored as raw
        // KB/s rather than a percentage — throughput has no ceiling to scale
        // against, so the sparkline autoscales against its own window instead.
        let rx = 0, tx = 0;
        for (const line of this._read('/proc/net/dev').split('\n').slice(2)) {
            const [ifname, rest] = line.split(':');
            if (!rest || ifname.trim() === 'lo')
                continue;
            const f = rest.trim().split(/\s+/).map(Number);
            rx += f[0] || 0;
            tx += f[8] || 0;
        }
        const now = GLib.get_monotonic_time();
        if (this._netPrev) {
            const dt = (now - this._netPrev.t) / 1e6;
            if (dt > 0) {
                this.value.rx = (rx - this._netPrev.rx) / dt;
                this.value.tx = (tx - this._netPrev.tx) / dt;
                this._push('net', (this.value.rx + this.value.tx) / 1024);
            }
        } else {
            this.value.rx = 0;
            this.value.tx = 0;
        }
        this._netPrev = {rx, tx, t: now};

        const up = parseFloat(this._read('/proc/uptime').split(' ')[0] || '0');
        this.value.up = up;
        this.value.node = (GLib.get_host_name() || 'ptai').split('.')[0].toUpperCase();
    }
}

const RATE = v => {
    if (v === undefined)
        return '—';
    if (v > 1048576)
        return `${(v / 1048576).toFixed(1)}M/S`;
    if (v > 1024)
        return `${Math.round(v / 1024)}K/S`;
    return `${Math.round(v)}B/S`;
};

const SPEC = {
    cpu:  {label: 'CPU',  key: 'cpu',  fmt: s => `${String(s.value.cpu ?? 0).padStart(2, '0')}%`,  bar: true},
    mem:  {label: 'MEM',  key: 'mem',  fmt: s => `${s.value.memPct ?? 0}%`, bar: true},
    temp: {label: 'TEMP', key: 'temp', fmt: s => s.value.temp !== undefined ? `${s.value.temp}C` : '—', bar: true},
    load: {label: 'LOAD', key: 'load', fmt: s => s.value.load ? s.value.load[0] : '—', bar: true},
    net:  {label: 'NET',  key: 'net',  fmt: s => `\u25b4${RATE(s.value.tx)} \u25be${RATE(s.value.rx)}`, bar: true, autoscale: true, width: 30},
    up:   {label: 'UP',   key: null,   fmt: s => {
        const h = Math.floor(s.value.up / 3600), m = Math.floor((s.value.up % 3600) / 60);
        return `${h}H${String(m).padStart(2, '0')}`;
    }, bar: false},
    node: {label: 'NODE', key: null,   fmt: s => s.value.node ?? 'PTAI', bar: false},
};

// A gauge: field name, live value, and a sparkline of recent samples. Clicking
// it opens a detail panel — the readout is the summary, the menu is the log.
const StatGauge = GObject.registerClass(
class StatGauge extends PanelMenu.Button {
    _init(field, sampler) {
        super._init(0.5, `PTAI ${field}`, false);
        this._field = field;
        this._spec = SPEC[field];
        this._sampler = sampler;
        this.add_style_class_name('ptai-gauge');

        const box = new St.BoxLayout({
            style_class: 'ptai-gauge-box',
            y_align: Clutter.ActorAlign.CENTER,
            // inline fallbacks: the actor must still be laid out correctly when
            // the user runs a shell theme that lacks the ptai classes
            style: 'spacing: 6px;',
        });
        const labelActor = new St.Label({
            text: this._spec.label,
            style_class: 'ptai-gauge-label',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'padding-right: 6px;',
        });
        // Panel labels ellipsize by default. With several gauges competing for
        // width St shrinks each label rather than the box, giving "CP… ME… TEM…".
        labelActor.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        labelActor.clutter_text.single_line_mode = true;
        box.add_child(labelActor);
        this._value = new St.Label({
            style_class: 'ptai-gauge-value',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._value.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._value.clutter_text.single_line_mode = true;
        box.add_child(this._value);

        if (this._spec.bar) {
            const sw = this._spec.width || 42;
            this._spark = new St.DrawingArea({
                style_class: 'ptai-gauge-spark',
                y_align: Clutter.ActorAlign.CENTER,
                // explicit geometry: a DrawingArea with no size never repaints,
                // and CSS height alone leaves it at zero if the class misses.
                // Matches the docs schematic proportions (12 slots, ~22px tall).
                width: sw,
                height: 22,
                style: `width: ${sw}px; height: 22px; padding-left: 6px;`,
            });
            this._spark.connect('repaint', a => this._paint(a));
            box.add_child(this._spark);
        }
        this.add_child(box);

        this._detail = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._detail);
        this.menu.connect('open-state-changed', (_m, open) => {
            if (open)
                this._buildDetail();
        });
        this.refresh();
    }

    // GNOME 46 dropped Clutter.cairo_set_source_color and Cogl colours changed
    // from 0-255 ints to 0-1 floats. Neither is safe to assume, and an exception
    // in a repaint handler silently draws nothing at all.
    _stroke(cr, c) {
        try {
            if (typeof cr.setSourceColor === 'function') {
                cr.setSourceColor(c);
                return;
            }
        } catch (e) {}
        try {
            if (Clutter.cairo_set_source_color) {
                Clutter.cairo_set_source_color(cr, c);
                return;
            }
        } catch (e) {}
        const n = v => (v === undefined ? 1 : (v > 1 ? v / 255 : v));
        cr.setSourceRGBA(n(c.red), n(c.green), n(c.blue), n(c.alpha));
    }

    // bar chart of the sample ring, oldest at the left, drawn in the theme's
    // own foreground colour so it tracks the preset
    _paint(area) {
        const [w, h] = area.get_surface_size();
        if (w < 2 || h < 2)
            return;
        const cr = area.get_context();
        try {
            let c;
            try {
                c = area.get_theme_node().get_foreground_color();
            } catch (e) {
                c = null;
            }
            this._stroke(cr, c || {red: 255, green: 255, blue: 255, alpha: 255});
            const hist = this._sampler.history[this._spec.key] || [];
            const slots = 12;
            const n = Math.min(hist.length, slots);
            const bw = w / slots;
            // Percentage metrics share a fixed 0-100 axis so their heights are
            // comparable; throughput has no ceiling, so it scales against the
            // largest sample in view and reads as shape rather than magnitude.
            const win = hist.slice(-slots);
            const top = this._spec.autoscale ? Math.max(8, ...win) : 100;
            for (let i = 0; i < n; i++) {
                const v = Math.max(0, Math.min(1, win[i] / top));
                const bh = Math.max(1, Math.round(v * (h - 1)));
                // Centred on the midline rather than sitting on the floor: a
                // bottom-anchored block reads as dropped below the label text,
                // since the text is centred on the same midline.
                const y = Math.round((h - bh) / 2);
                cr.rectangle(Math.round(i * bw), y, Math.max(1, Math.floor(bw) - 1), bh);
            }
            cr.fill();
        } catch (e) {
            logError(e, 'ptai: sparkline paint');
        } finally {
            cr.$dispose();
        }
    }

    refresh() {
        this._value.text = this._spec.fmt(this._sampler);
        if (this._spark) {
            // queue_repaint alone is dropped while the actor is considered clean
            this._spark.queue_repaint();
            this._spark.queue_relayout();
        }
        if (this.menu.isOpen)
            this._buildDetail();
    }

    _row(k, v) {
        const item = new PopupMenu.PopupBaseMenuItem({reactive: false});
        const box = new St.BoxLayout({style_class: 'ptai-detail-row', x_expand: true});
        box.add_child(new St.Label({text: k, style_class: 'ptai-detail-key', x_expand: true}));
        box.add_child(new St.Label({text: String(v), style_class: 'ptai-detail-val'}));
        item.add_child(box);
        this._detail.addMenuItem(item);
    }

    _buildDetail() {
        this._detail.removeAll();
        const s = this._sampler.value;
        const h = Math.floor((s.up || 0) / 3600), m = Math.floor(((s.up || 0) % 3600) / 60);
        this._row('NODE', s.node ?? '—');
        switch (this._field) {
        case 'cpu':
            this._row('UTILISATION', `${s.cpu ?? 0}%`);
            this._row('LOAD 1 / 5 / 15', (s.load || ['—']).join('  '));
            this._row('PROCESSES', s.procs || '—');
            this._row('PEAK (4 MIN)', `${Math.max(0, ...this._sampler.history.cpu)}%`);
            break;
        case 'mem':
            this._row('IN USE', `${s.memUsedGb ?? '—'} / ${s.memTotalGb ?? '—'} GB`);
            this._row('UTILISATION', `${s.memPct ?? 0}%`);
            this._row('SWAP', `${s.swapPct ?? 0}%`);
            break;
        case 'temp':
            this._row('SENSOR 0', s.temp !== undefined ? `${s.temp} C` : 'no sensor');
            this._row('PEAK (4 MIN)', `${Math.max(0, ...this._sampler.history.temp)} C`);
            break;
        case 'load':
            this._row('1 MIN', (s.load || ['—'])[0]);
            this._row('5 MIN', (s.load || [0, '—'])[1]);
            this._row('15 MIN', (s.load || [0, 0, '—'])[2]);
            this._row('PROCESSES', s.procs || '—');
            break;
        case 'net':
            this._row('DOWN', RATE(s.rx));
            this._row('UP', RATE(s.tx));
            this._row('PEAK (4 MIN)', RATE(Math.max(0, ...this._sampler.history.net) * 1024));
            break;
        default:
            this._row('UPTIME', `${h}H${String(m).padStart(2, '0')}`);
            this._row('CPU / MEM', `${s.cpu ?? 0}% / ${s.memPct ?? 0}%`);
            break;
        }
        this._row('SAMPLED', 'EVERY 2S');
    }
});

// A CRT overlay is a non-reactive DrawingArea painting scanlines, vignette and
// a phosphor wash. In 'terminal' mode one is pinned to each terminal window and
// follows its geometry; in 'screen' mode one covers each monitor.
class CrtOverlay {
    constructor(settings) {
        this._settings = settings;
        this._w = 0;
        this._h = 0;

        // Container so the sweep band can animate independently of the
        // static scanline/vignette paint underneath it.
        this.actor = new Clutter.Actor({
            reactive: false,
            clip_to_allocation: true,
            layout_manager: new Clutter.FixedLayout(),
        });

        this._layers = new St.DrawingArea({reactive: false});
        this._layers.connect('repaint', a => this._repaint(a));
        this.actor.add_child(this._layers);

        this._sweep = new St.DrawingArea({reactive: false});
        this._sweep.connect('repaint', a => this._repaintSweep(a));
        this.actor.add_child(this._sweep);
    }

    _repaintSweep(area) {
        const cr = area.get_context();
        const [w, h] = area.get_surface_size();
        cr.setOperator(Cairo.Operator.CLEAR);
        cr.paint();
        cr.setOperator(Cairo.Operator.OVER);
        if (w > 0 && h > 0) {
            const a = this._settings.get_double('sweep-opacity');
            const [r, g2, b] = this._rgba(this._settings.get_string('tint-color'));
            // phosphor-tinted band, brightest at its centre
            const g = new Cairo.LinearGradient(0, 0, 0, h);
            g.addColorStopRGBA(0, r, g2, b, 0);
            g.addColorStopRGBA(0.42, r, g2, b, a * 0.55);
            g.addColorStopRGBA(0.5, 1, 1, 1, a);
            g.addColorStopRGBA(0.58, r, g2, b, a * 0.55);
            g.addColorStopRGBA(1, r, g2, b, 0);
            cr.setSource(g);
            cr.rectangle(0, 0, w, h);
            cr.fill();
        }
        cr.$dispose();
    }

    startSweep() {
        this.stopSweep();
        if (!this._settings.get_boolean('sweep-enabled') ||
            this._settings.get_double('sweep-opacity') <= 0 ||
            this._w <= 0 || this._h <= 0)
            return;

        const band = Math.min(this._settings.get_int('sweep-height'), Math.max(20, this._h));
        const duration = this._settings.get_int('sweep-duration');
        this._sweep.set_size(this._w, band);
        this._sweep.show();
        this._sweep.queue_repaint();

        this._sweep.set_position(0, 0);
        const run = () => {
            this._sweep.remove_all_transitions();
            this._sweep.translation_y = -band;
            this._sweep.ease({
                translation_y: this._h,
                duration,
                mode: Clutter.AnimationMode.LINEAR,
                onComplete: () => {
                    if (this._sweepActive)
                        run();
                },
            });
        };
        this._sweepActive = true;
        // Clutter drops an ease() on an unmapped actor, so at startup the very
        // first transition is silently lost and the band only appears after a
        // resize re-triggers this. Defer until the actor is actually mapped.
        if (this._sweep.mapped) {
            run();
        } else {
            this._pendingRun = run;
            if (!this._mappedId) {
                this._mappedId = this._sweep.connect('notify::mapped', () => {
                    if (!this._sweep.mapped)
                        return;
                    this._sweep.disconnect(this._mappedId);
                    this._mappedId = 0;
                    if (this._sweepActive && this._pendingRun)
                        this._pendingRun();
                });
            }
        }
    }

    stopSweep() {
        this._sweepActive = false;
        this._pendingRun = null;
        if (this._mappedId) {
            this._sweep.disconnect(this._mappedId);
            this._mappedId = 0;
        }
        this._sweep.remove_all_transitions();
        this._sweep.hide();
    }

    _rgba(hex) {
        const h = (hex || '#3ff2a8').replace('#', '');
        return [
            parseInt(h.slice(0, 2), 16) / 255,
            parseInt(h.slice(2, 4), 16) / 255,
            parseInt(h.slice(4, 6), 16) / 255,
        ];
    }

    _repaint(area) {
        const cr = area.get_context();
        const [w, h] = area.get_surface_size();
        if (w <= 0 || h <= 0) {
            cr.$dispose();
            return;
        }

        cr.setOperator(Cairo.Operator.CLEAR);
        cr.paint();
        cr.setOperator(Cairo.Operator.OVER);

        const scanAlpha = this._settings.get_double('scanline-opacity');
        if (scanAlpha > 0) {
            const pitch = this._settings.get_int('scanline-pitch');
            const thickness = Math.max(1, Math.floor(pitch / 2));
            cr.setSourceRGBA(0, 0, 0, scanAlpha);
            for (let y = 0; y < h; y += pitch)
                cr.rectangle(0, y + (pitch - thickness), w, thickness);
            cr.fill();
        }

        const vigAlpha = this._settings.get_double('vignette-opacity');
        if (vigAlpha > 0) {
            const cx = w / 2, cy = h / 2;
            const r = Math.sqrt(cx * cx + cy * cy);
            const g = new Cairo.RadialGradient(cx, cy, r * 0.34, cx, cy, r);
            g.addColorStopRGBA(0, 0, 0, 0, 0);
            g.addColorStopRGBA(0.62, 0, 0, 0, vigAlpha * 0.42);
            g.addColorStopRGBA(1, 0, 0, 0, vigAlpha);
            cr.setSource(g);
            cr.rectangle(0, 0, w, h);
            cr.fill();
        }

        const tint = this._settings.get_double('tint-opacity');
        if (tint > 0) {
            const [r, g, b] = this._rgba(this._settings.get_string('tint-color'));
            cr.setSourceRGBA(r, g, b, tint);
            cr.rectangle(0, 0, w, h);
            cr.fill();
        }

        cr.$dispose();
    }

    setGeometry(x, y, w, h) {
        const changed = w !== this._w || h !== this._h;
        this._w = w;
        this._h = h;
        this.actor.set_position(x, y);
        this.actor.set_size(w, h);
        this._layers.set_size(w, h);
        this._layers.queue_repaint();
        if (changed)
            this.startSweep();
    }

    queueRepaint() {
        this._layers.queue_repaint();
        this._sweep.queue_repaint();
    }

    destroy() {
        this.stopSweep();
        this.actor.destroy();
    }
}

// The top bar, dressed as a facility console: a corporate wordmark bolted to
// the left edge, a live system readout on the right, and a hazard stripe along
// the bottom. All three are plain panel children, so they sit inside the shell
// theme's own #panel styling and survive monitor and theme changes.
class PanelFurniture {
    constructor(settings) {
        this._settings = settings;
        this._items = [];
        this._timer = null;
        this._boot = GLib.get_monotonic_time();
        this._ids = [
            'panel-wordmark', 'panel-org', 'panel-subtitle',
            'panel-readout', 'panel-readout-fields', 'panel-hazard',
            'panel-stats', 'panel-height', 'panel-clock',
        ].map(k => settings.connect(`changed::${k}`, () => this.rebuild()));
        this.rebuild();
    }

    rebuild() {
        this._clear();
        this._applyHeight();
        this._placeClock();

        if (this._settings.get_boolean('panel-wordmark'))
            this._addWordmark();

        if (this._settings.get_boolean('panel-hazard'))
            this._addHazard();

        if (this._settings.get_boolean('panel-readout'))
            this._addReadout();
    }

    // GNOME parks the clock in the panel's centre box. The PTAI bar reads as a
    // left group / gap / right group, so the clock moves into the left box after
    // the wordmark. Reparenting is reversible and restored in _clear().
    _placeClock() {
        const dm = Main.panel.statusArea?.dateMenu;
        if (!dm)
            return;
        const target = this._settings.get_string('panel-clock');
        const boxes = {
            left: Main.panel._leftBox,
            center: Main.panel._centerBox,
            right: Main.panel._rightBox,
        };
        const box = boxes[target] || boxes.center;
        const parent = dm.container.get_parent();
        if (parent === box)
            return;
        this._clockHome = this._clockHome || parent;
        parent?.remove_child(dm.container);
        box.add_child(dm.container);
        this._clockMoved = true;
    }

    _restoreClock() {
        const dm = Main.panel.statusArea?.dateMenu;
        if (!this._clockMoved || !dm || !this._clockHome)
            return;
        dm.container.get_parent()?.remove_child(dm.container);
        this._clockHome.add_child(dm.container);
        this._clockMoved = false;
    }

    _addWordmark() {
        const box = new St.BoxLayout({
            style_class: 'panel-button ptai-wordmark',
            reactive: false, can_focus: false, track_hover: false,
            y_align: Clutter.ActorAlign.CENTER,
        });
        const org = new St.Label({
            text: this._settings.get_string('panel-org'),
            style_class: 'ptai-wordmark-org',
            y_align: Clutter.ActorAlign.CENTER,
        });
        // Panel labels ellipsize by default, and St shrinks the left box before
        // the right one, so the wordmark is what gets cut to "HELIOS-YUTAN…".
        org.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        org.clutter_text.single_line_mode = true;
        box.add_child(org);
        const sub = this._settings.get_string('panel-subtitle');
        if (sub) {
            const subLabel = new St.Label({
                text: sub,
                style_class: 'ptai-wordmark-sub',
                y_align: Clutter.ActorAlign.CENTER,
            });
            subLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            box.add_child(subLabel);
        }
        Main.panel._leftBox.insert_child_at_index(box, 0);
        this._items.push(box);
    }

    _addHazard() {
        // Drawn rather than tiled: St has no repeating background, and a Cairo
        // pass here is cheaper than shipping and scaling an image asset.
        const stripe = new St.DrawingArea({
            style_class: 'ptai-hazard',
            reactive: false,
            x_expand: true,
            height: 3,
        });
        stripe.connect('repaint', area => {
            const cr = area.get_context();
            const [w, h] = area.get_surface_size();
            const node = area.get_theme_node();
            const c = node.get_foreground_color();
            cr.setOperator(Cairo.Operator.CLEAR);
            cr.paint();
            cr.setOperator(Cairo.Operator.OVER);
            cr.setSourceRGBA(c.red / 255, c.green / 255, c.blue / 255, c.alpha / 255);
            const pitch = 10;
            for (let x = -h; x < w + h; x += pitch) {
                cr.moveTo(x, h);
                cr.lineTo(x + h, 0);
                cr.lineTo(x + h + pitch / 2, 0);
                cr.lineTo(x + pitch / 2, h);
                cr.closePath();
            }
            cr.fill();
            cr.$dispose();
        });

        const panel = Main.panel;
        panel.add_child(stripe);
        const place = () => {
            stripe.set_position(0, Math.max(0, panel.height - stripe.height));
            stripe.set_width(panel.width);
        };
        place();
        this._hazardId = panel.connect('notify::allocation', place);
        this._hazard = stripe;
        this._items.push(stripe);
    }

    // The shell theme ships a 30px bar; taller is a style override on the panel
    // actor so the panelBox and every struts consumer follow it.
    _applyHeight() {
        const h = this._settings.get_int('panel-height');
        Main.panel.style = h > 0 ? `height: ${h}px;` : null;
    }

    _addReadout() {
        if (this._settings.get_boolean('panel-stats')) {
            this._addGauges();
            return;
        }
        const label = new St.Label({
            style_class: 'panel-button ptai-readout',
            y_align: Clutter.ActorAlign.CENTER,
        });
        const box = new St.BoxLayout({
            style_class: 'ptai-readout-box',
            reactive: false, can_focus: false, track_hover: false,
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(label);
        Main.panel._rightBox.insert_child_at_index(box, 0);
        this._items.push(box);
        this._label = label;

        this._tick();
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT_IDLE, 5, () => {
            this._tick();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _addGauges() {
        this._sampler = new Sampler();
        this._gauges = [];
        const fields = this._settings.get_strv('panel-readout-fields').filter(f => SPEC[f]);
        const order = (fields.length ? fields : ['cpu', 'mem', 'net', 'temp', 'up']);
        // Each insert at index 0 in the right box pushes the previous one further
        // right, which reverses the list. Walk it backwards so the rendered order
        // matches the configured order.
        for (const f of order.slice().reverse()) {
            const g = new StatGauge(f, this._sampler);
            Main.panel.addToStatusArea(`ptai-${f}`, g, 0, 'right');
            this._gauges.push(g);
            this._items.push(g);
        }
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT_IDLE, 2, () => {
            this._sampler.sample();
            this._gauges.forEach(g => g.refresh());
            return GLib.SOURCE_CONTINUE;
        });
    }

    _read(path) {
        try {
            const [ok, bytes] = GLib.file_get_contents(path);
            return ok ? new TextDecoder().decode(bytes) : '';
        } catch (e) {
            return '';
        }
    }

    _field(name) {
        switch (name) {
        case 'node': {
            const h = GLib.get_host_name() || 'ptai';
            return `NODE ${h.split('.')[0].toUpperCase()}`;
        }
        case 'load': {
            const v = this._read('/proc/loadavg').split(' ')[0];
            return v ? `LOAD ${v}` : null;
        }
        case 'mem': {
            const t = this._read('/proc/meminfo');
            const get = k => {
                const m = t.match(new RegExp(`^${k}:\\s+(\\d+)`, 'm'));
                return m ? parseInt(m[1], 10) : 0;
            };
            const total = get('MemTotal');
            const avail = get('MemAvailable');
            if (!total)
                return null;
            return `MEM ${Math.round((1 - avail / total) * 100)}%`;
        }
        case 'up': {
            const s = parseFloat(this._read('/proc/uptime').split(' ')[0] || '0');
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            return `UP ${h}H${String(m).padStart(2, '0')}`;
        }
        case 'temp': {
            const raw = this._read('/sys/class/thermal/thermal_zone0/temp').trim();
            if (!raw)
                return null;
            return `TEMP ${Math.round(parseInt(raw, 10) / 1000)}C`;
        }
        default:
            return null;
        }
    }

    _tick() {
        if (!this._label)
            return;
        const parts = this._settings.get_strv('panel-readout-fields')
            .map(f => this._field(f))
            .filter(v => v);
        this._label.text = parts.length ? parts.join('  \u00b7  ') : 'SYSTEM NOMINAL';
    }

    _clear() {
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = null;
        }
        if (this._hazardId) {
            try { Main.panel.disconnect(this._hazardId); } catch (e) {}
            this._hazardId = null;
        }
        this._hazard = null;
        this._label = null;
        this._gauges = null;
        this._sampler = null;
        this._items.forEach(a => a.destroy());
        this._items = [];
    }

    destroy() {
        this._clear();
        this._restoreClock();
        Main.panel.style = null;
        this._ids?.forEach(id => this._settings.disconnect(id));
        this._ids = null;
    }
}

export default class PtaiCrtExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._monitorOverlays = [];
        this._windowOverlays = new Map();
        this._windowSignals = new Map();

        this._drawKeys = [
            'scanline-opacity', 'scanline-pitch', 'vignette-opacity',
            'tint-opacity', 'tint-color',
        ].map(k => this._settings.connect(`changed::${k}`, () => this._redraw()));

        this._modeKeys = [
            this._settings.connect('changed::target', () => this._rebuild()),
            this._settings.connect('changed::terminal-classes', () => this._rebuild()),
            this._settings.connect('changed::flicker-enabled', () => this._resetFlicker()),
            this._settings.connect('changed::flicker-depth', () => this._resetFlicker()),
            ...['sweep-enabled', 'sweep-opacity', 'sweep-height', 'sweep-duration']
                .map(k => this._settings.connect(`changed::${k}`, () => this._resetSweep())),
        ];

        this._monitorsId = Main.layoutManager.connect('monitors-changed', () => this._rebuild());
        this._createdId = global.display.connect('window-created', () => this._syncWindows());
        this._restackId = global.display.connect('restacked', () => this._syncWindows());

        this._panel = new PanelFurniture(this._settings);

        this._rebuild();
    }

    disable() {
        this._stopFlicker();

        this._panel?.destroy();
        this._panel = null;

        if (this._monitorsId) {
            Main.layoutManager.disconnect(this._monitorsId);
            this._monitorsId = null;
        }
        for (const id of [this._createdId, this._restackId]) {
            if (id)
                global.display.disconnect(id);
        }
        this._createdId = this._restackId = null;

        this._drawKeys?.forEach(id => this._settings.disconnect(id));
        this._modeKeys?.forEach(id => this._settings.disconnect(id));
        this._drawKeys = this._modeKeys = null;

        this._teardown();
        this._settings = null;
    }

    _teardown() {
        this._monitorOverlays?.forEach(o => o.destroy());
        this._monitorOverlays = [];

        for (const [win, ids] of this._windowSignals ?? [])
            ids.forEach(id => { try { win.disconnect(id); } catch (e) {} });
        this._windowSignals = new Map();

        for (const overlay of this._windowOverlays?.values() ?? [])
            overlay.destroy();
        this._windowOverlays = new Map();
    }

    get _terminalMode() {
        return this._settings.get_string('target') !== 'screen';
    }

    _rebuild() {
        this._teardown();

        if (this._terminalMode)
            this._syncWindows();
        else
            this._buildMonitorOverlays();

        this._resetFlicker();
        this._resetSweep();
    }

    _buildMonitorOverlays() {
        for (const monitor of Main.layoutManager.monitors) {
            const overlay = new CrtOverlay(this._settings);
            Main.layoutManager.uiGroup.add_child(overlay.actor);
            Main.layoutManager.uiGroup.set_child_above_sibling(overlay.actor, null);
            overlay.setGeometry(monitor.x, monitor.y, monitor.width, monitor.height);
            this._monitorOverlays.push(overlay);
        }
    }

    // ---- terminal-window tracking ----

    _isTerminal(win) {
        if (!win || win.get_window_type() !== Meta.WindowType.NORMAL)
            return false;

        const patterns = this._settings.get_strv('terminal-classes')
            .map(s => s.toLowerCase())
            .filter(s => s.length);
        if (!patterns.length)
            return false;

        const candidates = [
            win.get_wm_class(),
            win.get_wm_class_instance(),
            win.get_gtk_application_id(),
        ].filter(v => v).map(v => v.toLowerCase());

        return candidates.some(c => patterns.some(p => c.includes(p)));
    }

    _syncWindows() {
        if (!this._terminalMode)
            return;

        const wanted = new Set(
            global.get_window_actors()
                .map(a => a.meta_window)
                .filter(w => this._isTerminal(w)));

        for (const win of [...this._windowOverlays.keys()]) {
            if (!wanted.has(win))
                this._untrack(win);
        }
        for (const win of wanted) {
            if (!this._windowOverlays.has(win))
                this._track(win);
        }
    }

    _track(win) {
        const actor = win.get_compositor_private();
        if (!actor)
            return;

        const overlay = new CrtOverlay(this._settings);
        // Parent to the window actor so the overlay clips to the window, rides
        // its stacking order, and disappears with it on minimise or workspace change.
        actor.add_child(overlay.actor);
        this._windowOverlays.set(win, overlay);

        const place = () => {
            const frame = win.get_frame_rect();
            const buffer = win.get_buffer_rect();
            // offset the client area inside the buffer (shadow margins)
            overlay.setGeometry(
                frame.x - buffer.x,
                frame.y - buffer.y,
                frame.width,
                frame.height);
            actor.set_child_above_sibling(overlay.actor, null);
        };
        place();

        this._windowSignals.set(win, [
            win.connect('position-changed', place),
            win.connect('size-changed', place),
            win.connect('unmanaged', () => this._untrack(win)),
        ]);
    }

    _untrack(win) {
        const ids = this._windowSignals.get(win);
        if (ids) {
            ids.forEach(id => { try { win.disconnect(id); } catch (e) {} });
            this._windowSignals.delete(win);
        }
        const overlay = this._windowOverlays.get(win);
        if (overlay) {
            overlay.destroy();
            this._windowOverlays.delete(win);
        }
    }

    // ---- shared ----

    _allOverlays() {
        return [...this._monitorOverlays, ...this._windowOverlays.values()];
    }

    _redraw() {
        this._allOverlays().forEach(o => o.queueRepaint());
    }

    _resetSweep() {
        this._allOverlays().forEach(o => o.startSweep());
    }

    _stopFlicker() {
        if (this._flickerId) {
            GLib.source_remove(this._flickerId);
            this._flickerId = null;
        }
        this._allOverlays().forEach(o => { o.actor.opacity = 255; });
    }

    _resetFlicker() {
        this._stopFlicker();
        if (!this._settings.get_boolean('flicker-enabled'))
            return;

        this._flickerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, 90, () => {
            const depth = this._settings.get_double('flicker-depth');
            const jitter = Math.random() < 0.12 ? 2.6 : 1.0;
            const target = 255 - Math.round(Math.random() * depth * 255 * jitter);
            for (const o of this._allOverlays()) {
                o.actor.ease({
                    opacity: Math.max(150, Math.min(255, target)),
                    duration: 80,
                    mode: Clutter.AnimationMode.LINEAR,
                });
            }
            return GLib.SOURCE_CONTINUE;
        });
    }
}
