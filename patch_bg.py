#!/usr/bin/env python3
"""patch_bg.py — Adds the African Village artistic background theme"""
import sys, shutil
from pathlib import Path

DRY  = "--dry-run" in sys.argv
PROJ = Path("/home/fizzme/fizzme/projec")

FILES = {
    "ui.js":       PROJ / "static/js/modules/ui.js",
    "settings.js": PROJ / "static/js/modules/settings.js",
}

for name, path in FILES.items():
    if not path.exists():
        print(f"ERROR: {path} not found."); sys.exit(1)

PATCHES = [
    # ── ui.js ────────────────────────────────────────────────────────
    (
        "ui.js",
        "Update BG_THEMES object",
        """    var BG_THEMES = {
      default: 'url("data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'200\\' height=\\'200\\'%3E%3Cdefs%3E%3Cstyle%3E.s%7Bfill:none;stroke:%23163347;stroke-linecap:round;stroke-linejoin:round%7D.sf%7Bfill:%23163347%7D%3C/style%3E%3C/defs%3E%3C!-- hut 1 --%3E%3Cellipse cx=\\'30\\' cy=\\'72\\' rx=\\'18\\' ry=\\'4\\' fill=\\'%23112a3a\\'/%3E%3Crect x=\\'14\\' y=\\'60\\' width=\\'32\\' height=\\'14\\' rx=\\'2\\' class=\\'sf\\'/%3E%3Cpolygon points=\\'10,62 30,42 50,62\\' fill=\\'%231a3d52\\'/%3E%3Cellipse cx=\\'30\\' cy=\\'62\\' rx=\\'20\\' ry=\\'3\\' fill=\\'%231e4a62\\'/%3E%3Cline x1=\\'20\\' y1=\\'62\\' x2=\\'20\\' y2=\\'74\\' class=\\'s\\' stroke-width=\\'1\\'/%3E%3Cline x1=\\'30\\' y1=\\'62\\' x2=\\'30\\' y2=\\'74\\' class=\\'s\\' stroke-width=\\'1\\'/%3E%3Cline x1=\\'40\\' y1=\\'62\\' x2=\\'40\\' y2=\\'74\\' class=\\'s\\' stroke-width=\\'1\\'/%3E%3Crect x=\\'25\\' y=\\'67\\' width=\\'10\\' height=\\'8\\' rx=\\'1\\' fill=\\'%230d2233\\'/%3E%3C!-- hut 2 small --%3E%3Cellipse cx=\\'160\\' cy=\\'52\\' rx=\\'12\\' ry=\\'3\\' fill=\\'%23112a3a\\'/%3E%3Crect x=\\'150\\' y=\\'44\\' width=\\'20\\' height=\\'10\\' rx=\\'2\\' class=\\'sf\\'/%3E%3Cpolygon points=\\'147,46 160,30 173,46\\' fill=\\'%231a3d52\\'/%3E%3Cellipse cx=\\'160\\' cy=\\'46\\' rx=\\'13\\' ry=\\'2.5\\' fill=\\'%231e4a62\\'/%3E%3Cline x1=\\'154\\' y1=\\'46\\' x2=\\'154\\' y2=\\'54\\' class=\\'s\\' stroke-width=\\'1\\'/%3E%3Cline x1=\\'160\\' y1=\\'46\\' x2=\\'160\\' y2=\\'54\\' class=\\'s\\' stroke-width=\\'1\\'/%3E%3Cline x1=\\'166\\' y1=\\'46\\' x2=\\'166\\' y2=\\'54\\' class=\\'s\\' stroke-width=\\'1\\'/%3E%3C!-- drummer figure 1 --%3E%3Ccircle cx=\\'80\\' cy=\\'100\\' r=\\'6\\' fill=\\'%231e4a62\\'/%3E%3Crect x=\\'77\\' y=\\'106\\' width=\\'6\\' height=\\'14\\' rx=\\'3\\' fill=\\'%231a3d52\\'/%3E%3Cline x1=\\'77\\' y1=\\'110\\' x2=\\'70\\' y2=\\'116\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3Cline x1=\\'83\\' y1=\\'110\\' x2=\\'90\\' y2=\\'116\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3Cline x1=\\'79\\' y1=\\'120\\' x2=\\'75\\' y2=\\'132\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3Cline x1=\\'83\\' y1=\\'120\\' x2=\\'87\\' y2=\\'132\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3C!-- drum under drummer 1 --%3E%3Cellipse cx=\\'90\\' cy=\\'122\\' rx=\\'7\\' ry=\\'3\\' fill=\\'%23163347\\'/%3E%3Crect x=\\'83\\' y=\\'118\\' width=\\'14\\' height=\\'10\\' rx=\\'2\\' fill=\\'%231a3d52\\'/%3E%3Cellipse cx=\\'90\\' cy=\\'118\\' rx=\\'7\\' ry=\\'2.5\\' fill=\\'%231e4a62\\'/%3E%3C!-- drummer figure 2 --%3E%3Ccircle cx=\\'130\\' cy=\\'110\\' r=\\'6\\' fill=\\'%231e4a62\\'/%3E%3Crect x=\\'127\\' y=\\'116\\' width=\\'6\\' height=\\'14\\' rx=\\'3\\' fill=\\'%231a3d52\\'/%3E%3Cline x1=\\'127\\' y1=\\'120\\' x2=\\'120\\' y2=\\'126\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3Cline x1=\\'133\\' y1=\\'120\\' x2=\\'140\\' y2=\\'126\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3Cline x1=\\'129\\' y1=\\'130\\' x2=\\'125\\' y2=\\'142\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3Cline x1=\\'133\\' y1=\\'130\\' x2=\\'137\\' y2=\\'142\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3C!-- drum standalone --%3E%3Cellipse cx=\\'55\\' cy=\\'150\\' rx=\\'9\\' ry=\\'3.5\\' fill=\\'%23163347\\'/%3E%3Crect x=\\'46\\' y=\\'144\\' width=\\'18\\' height=\\'12\\' rx=\\'3\\' fill=\\'%231a3d52\\'/%3E%3Cellipse cx=\\'55\\' cy=\\'144\\' rx=\\'9\\' ry=\\'3\\' fill=\\'%231e4a62\\'/%3E%3C!-- acacia tree 1 --%3E%3Cline x1=\\'170\\' y1=\\'170\\' x2=\\'170\\' y2=\\'140\\' class=\\'s\\' stroke-width=\\'2\\'/%3E%3Cellipse cx=\\'158\\' cy=\\'135\\' rx=\\'14\\' ry=\\'6\\' fill=\\'%23163347\\'/%3E%3Cellipse cx=\\'172\\' cy=\\'130\\' rx=\\'16\\' ry=\\'7\\' fill=\\'%231a3d52\\'/%3E%3Cellipse cx=\\'183\\' cy=\\'136\\' rx=\\'12\\' ry=\\'5\\' fill=\\'%23163347\\'/%3E%3C!-- acacia tree 2 small --%3E%3Cline x1=\\'40\\' cy=\\'170\\' x2=\\'40\\' y2=\\'155\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3Cellipse cx=\\'32\\' cy=\\'152\\' rx=\\'10\\' ry=\\'4\\' fill=\\'%23163347\\'/%3E%3Cellipse cx=\\'42\\' cy=\\'149\\' rx=\\'11\\' ry=\\'5\\' fill=\\'%231a3d52\\'/%3E%3Cellipse cx=\\'50\\' cy=\\'153\\' rx=\\'8\\' ry=\\'3.5\\' fill=\\'%23163347\\'/%3E%3C!-- leaf scatter --%3E%3Cellipse cx=\\'100\\' cy=\\'170\\' rx=\\'4\\' ry=\\'2\\' fill=\\'%23163347\\' transform=\\'rotate(-20,100,170)\\'/%3E%3Cellipse cx=\\'145\\' cy=\\'80\\' rx=\\'3\\' ry=\\'1.5\\' fill=\\'%23163347\\' transform=\\'rotate(15,145,80)\\'/%3E%3Cellipse cx=\\'60\\' cy=\\'40\\' rx=\\'3\\' ry=\\'1.5\\' fill=\\'%23163347\\' transform=\\'rotate(-30,60,40)\\'/%3E%3C!-- drumstick --%3E%3Cline x1=\\'95\\' y1=\\'115\\' x2=\\'103\\' y2=\\'110\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3Ccircle cx=\\'103\\' cy=\\'109\\' r=\\'2\\' fill=\\'%231e4a62\\'/%3E%3C/svg%3E")',
      dark: '#0a1929',
      light: '#e8edee',
      green: 'linear-gradient(135deg, #0a1929, #128c7e)',
    };""",
        """    var BG_THEMES = {
      default: 'url("data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'200\\' height=\\'200\\'%3E%3Cdefs%3E%3Cstyle%3E.s%7Bfill:none;stroke:%23163347;stroke-linecap:round;stroke-linejoin:round%7D.sf%7Bfill:%23163347%7D%3C/style%3E%3C/defs%3E%3C!-- hut 1 --%3E%3Cellipse cx=\\'30\\' cy=\\'72\\' rx=\\'18\\' ry=\\'4\\' fill=\\'%23112a3a\\'/%3E%3Crect x=\\'14\\' y=\\'60\\' width=\\'32\\' height=\\'14\\' rx=\\'2\\' class=\\'sf\\'/%3E%3Cpolygon points=\\'10,62 30,42 50,62\\' fill=\\'%231a3d52\\'/%3E%3Cellipse cx=\\'30\\' cy=\\'62\\' rx=\\'20\\' ry=\\'3\\' fill=\\'%231e4a62\\'/%3E%3Cline x1=\\'20\\' y1=\\'62\\' x2=\\'20\\' y2=\\'74\\' class=\\'s\\' stroke-width=\\'1\\'/%3E%3Cline x1=\\'30\\' y1=\\'62\\' x2=\\'30\\' y2=\\'74\\' class=\\'s\\' stroke-width=\\'1\\'/%3E%3Cline x1=\\'40\\' y1=\\'62\\' x2=\\'40\\' y2=\\'74\\' class=\\'s\\' stroke-width=\\'1\\'/%3E%3Crect x=\\'25\\' y=\\'67\\' width=\\'10\\' height=\\'8\\' rx=\\'1\\' fill=\\'%230d2233\\'/%3E%3C!-- hut 2 small --%3E%3Cellipse cx=\\'160\\' cy=\\'52\\' rx=\\'12\\' ry=\\'3\\' fill=\\'%23112a3a\\'/%3E%3Crect x=\\'150\\' y=\\'44\\' width=\\'20\\' height=\\'10\\' rx=\\'2\\' class=\\'sf\\'/%3E%3Cpolygon points=\\'147,46 160,30 173,46\\' fill=\\'%231a3d52\\'/%3E%3Cellipse cx=\\'160\\' cy=\\'46\\' rx=\\'13\\' ry=\\'2.5\\' fill=\\'%231e4a62\\'/%3E%3Cline x1=\\'154\\' y1=\\'46\\' x2=\\'154\\' y2=\\'54\\' class=\\'s\\' stroke-width=\\'1\\'/%3E%3Cline x1=\\'160\\' y1=\\'46\\' x2=\\'160\\' y2=\\'54\\' class=\\'s\\' stroke-width=\\'1\\'/%3E%3Cline x1=\\'166\\' y1=\\'46\\' x2=\\'166\\' y2=\\'54\\' class=\\'s\\' stroke-width=\\'1\\'/%3E%3C!-- drummer figure 1 --%3E%3Ccircle cx=\\'80\\' cy=\\'100\\' r=\\'6\\' fill=\\'%231e4a62\\'/%3E%3Crect x=\\'77\\' y=\\'106\\' width=\\'6\\' height=\\'14\\' rx=\\'3\\' fill=\\'%231a3d52\\'/%3E%3Cline x1=\\'77\\' y1=\\'110\\' x2=\\'70\\' y2=\\'116\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3Cline x1=\\'83\\' y1=\\'110\\' x2=\\'90\\' y2=\\'116\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3Cline x1=\\'79\\' y1=\\'120\\' x2=\\'75\\' y2=\\'132\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3Cline x1=\\'83\\' y1=\\'120\\' x2=\\'87\\' y2=\\'132\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3C!-- drum under drummer 1 --%3E%3Cellipse cx=\\'90\\' cy=\\'122\\' rx=\\'7\\' ry=\\'3\\' fill=\\'%23163347\\'/%3E%3Crect x=\\'83\\' y=\\'118\\' width=\\'14\\' height=\\'10\\' rx=\\'2\\' fill=\\'%231a3d52\\'/%3E%3Cellipse cx=\\'90\\' cy=\\'118\\' rx=\\'7\\' ry=\\'2.5\\' fill=\\'%231e4a62\\'/%3E%3C!-- drummer figure 2 --%3E%3Ccircle cx=\\'130\\' cy=\\'110\\' r=\\'6\\' fill=\\'%231e4a62\\'/%3E%3Crect x=\\'127\\' y=\\'116\\' width=\\'6\\' height=\\'14\\' rx=\\'3\\' fill=\\'%231a3d52\\'/%3E%3Cline x1=\\'127\\' y1=\\'120\\' x2=\\'120\\' y2=\\'126\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3Cline x1=\\'133\\' y1=\\'120\\' x2=\\'140\\' y2=\\'126\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3Cline x1=\\'129\\' y1=\\'130\\' x2=\\'125\\' y2=\\'142\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3Cline x1=\\'133\\' y1=\\'130\\' x2=\\'137\\' y2=\\'142\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3C!-- drum standalone --%3E%3Cellipse cx=\\'55\\' cy=\\'150\\' rx=\\'9\\' ry=\\'3.5\\' fill=\\'%23163347\\'/%3E%3Crect x=\\'46\\' y=\\'144\\' width=\\'18\\' height=\\'12\\' rx=\\'3\\' fill=\\'%231a3d52\\'/%3E%3Cellipse cx=\\'55\\' cy=\\'144\\' rx=\\'9\\' ry=\\'3\\' fill=\\'%231e4a62\\'/%3E%3C!-- acacia tree 1 --%3E%3Cline x1=\\'170\\' y1=\\'170\\' x2=\\'170\\' y2=\\'140\\' class=\\'s\\' stroke-width=\\'2\\'/%3E%3Cellipse cx=\\'158\\' cy=\\'135\\' rx=\\'14\\' ry=\\'6\\' fill=\\'%23163347\\'/%3E%3Cellipse cx=\\'172\\' cy=\\'130\\' rx=\\'16\\' ry=\\'7\\' fill=\\'%231a3d52\\'/%3E%3Cellipse cx=\\'183\\' cy=\\'136\\' rx=\\'12\\' ry=\\'5\\' fill=\\'%23163347\\'/%3E%3C!-- acacia tree 2 small --%3E%3Cline x1=\\'40\\' cy=\\'170\\' x2=\\'40\\' y2=\\'155\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3Cellipse cx=\\'32\\' cy=\\'152\\' rx=\\'10\\' ry=\\'4\\' fill=\\'%23163347\\'/%3E%3Cellipse cx=\\'42\\' cy=\\'149\\' rx=\\'11\\' ry=\\'5\\' fill=\\'%231a3d52\\'/%3E%3Cellipse cx=\\'50\\' cy=\\'153\\' rx=\\'8\\' ry=\\'3.5\\' fill=\\'%23163347\\'/%3E%3C!-- leaf scatter --%3E%3Cellipse cx=\\'100\\' cy=\\'170\\' rx=\\'4\\' ry=\\'2\\' fill=\\'%23163347\\' transform=\\'rotate(-20,100,170)\\'/%3E%3Cellipse cx=\\'145\\' cy=\\'80\\' rx=\\'3\\' ry=\\'1.5\\' fill=\\'%23163347\\' transform=\\'rotate(15,145,80)\\'/%3E%3Cellipse cx=\\'60\\' cy=\\'40\\' rx=\\'3\\' ry=\\'1.5\\' fill=\\'%23163347\\' transform=\\'rotate(-30,60,40)\\'/%3E%3C!-- drumstick --%3E%3Cline x1=\\'95\\' y1=\\'115\\' x2=\\'103\\' y2=\\'110\\' class=\\'s\\' stroke-width=\\'1.5\\'/%3E%3Ccircle cx=\\'103\\' cy=\\'109\\' r=\\'2\\' fill=\\'%231e4a62\\'/%3E%3C/svg%3E")',
      dark: '#0a1929',
      light: '#e8edee',
      village: 'url("/static/images/african_village_bg.jpg")',
    };"""
    ),
    (
        "ui.js",
        "Update applyBackground logic",
        """    if (theme === 'default') {
      area.style.backgroundImage = BG_THEMES.default;
      area.style.backgroundColor = '#0a1929';
      area.style.backgroundRepeat = 'repeat';
      area.style.backgroundSize = '200px 200px';
    } else {
      area.style.backgroundColor = BG_THEMES[theme] || '#0a1929';
    }""",
        """    if (theme === 'default') {
      area.style.backgroundImage = BG_THEMES.default;
      area.style.backgroundColor = '#0a1929';
      area.style.backgroundRepeat = 'repeat';
      area.style.backgroundSize = '200px 200px';
    } else if (theme === 'village') {
      area.style.backgroundImage = 'linear-gradient(rgba(10, 25, 41, 0.65), rgba(10, 25, 41, 0.65)), ' + BG_THEMES.village;
      area.style.backgroundColor = '#0a1929';
      area.style.backgroundSize = 'cover';
      area.style.backgroundPosition = 'center';
    } else {
      area.style.backgroundColor = BG_THEMES[theme] || '#0a1929';
    }"""
    ),
    (
        "ui.js",
        "Update renderBgThumbs",
        """    var themes = ['default', 'dark', 'light', 'green'];
    var labels = ['Default', 'Dark', 'Light', 'Green'];
    var current = localStorage.getItem('asterix_bg') || 'default';
    themes.forEach(function(t, i) {
      var div = document.createElement('div');
      div.className = 'bg-thumb' + (t === current ? ' active' : '');
      div.setAttribute('data-theme', t);
      div.innerHTML = '<div style="width:100%;height:100%;background:' + (BG_THEMES[t] || '#0a1929') + ';border-radius:8px;"></div>' +
        '<div class="bg-thumb-label">' + labels[i] + '</div>';""",
        """    var themes = ['default', 'dark', 'light', 'village'];
    var labels = ['Default', 'Dark', 'Light', 'Village'];
    var current = localStorage.getItem('asterix_bg') || 'default';
    themes.forEach(function(t, i) {
      var div = document.createElement('div');
      div.className = 'bg-thumb' + (t === current ? ' active' : '');
      div.setAttribute('data-theme', t);
      var bgStyle = BG_THEMES[t] || '#0a1929';
      if (t === 'village') bgStyle = 'url("/static/images/african_village_bg.jpg") center/cover';
      div.innerHTML = '<div style="width:100%;height:100%;background:' + bgStyle + ';border-radius:8px;"></div>' +
        '<div class="bg-thumb-label">' + labels[i] + '</div>';"""
    ),

    # ── settings.js ──────────────────────────────────────────────────
    (
        "settings.js",
        "Update BG_THEMES array",
        """var BG_THEMES = [
  {
    id: 'default',
    label: 'Default',
    draw: function(ctx, w, h) {
      ctx.fillStyle = '#0a1929';
      ctx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'dark_green',
    label: 'Forest',
    draw: function(ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#0d2b0d'); g.addColorStop(1, '#0a1a0a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'navy',
    label: 'Night Sky',
    draw: function(ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#050a1a'); g.addColorStop(1, '#0a1535');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'charcoal',
    label: 'Charcoal',
    draw: function(ctx, w, h) {
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'warm_dark',
    label: 'Warm Dark',
    draw: function(ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#1a1208'); g.addColorStop(1, '#0f0b04');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'purple_dark',
    label: 'Midnight',
    draw: function(ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#120820'); g.addColorStop(1, '#0a0510');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  }
];""",
        """var BG_THEMES = [
  {
    id: 'default',
    label: 'Default',
    draw: function(ctx, w, h) {
      ctx.fillStyle = '#0a1929';
      ctx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'village',
    label: 'African Village',
    isImage: true,
    url: '/static/images/african_village_bg.jpg'
  },
  {
    id: 'charcoal',
    label: 'Charcoal',
    draw: function(ctx, w, h) {
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'warm_dark',
    label: 'Warm Dark',
    draw: function(ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#1a1208'); g.addColorStop(1, '#0f0b04');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'purple_dark',
    label: 'Midnight',
    draw: function(ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#120820'); g.addColorStop(1, '#0a0510');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  }
];"""
    ),
    (
        "settings.js",
        "Update applyBackground function",
        """  // Default theme – use SVG pattern
  if (theme.id === 'default') {
    setBackground(box, DEFAULT_BG_PATTERN, '200px 200px', 'repeat', '#0a1929');
    document.getElementById('current-bg-label').textContent = 'Default pattern';
    _currentBgId = 'default';
    localStorage.setItem('asterix_bg', 'default');
    document.querySelectorAll('.bg-thumb').forEach(function(t) {
      t.classList.toggle('active', t.dataset.bgId === 'default');
    });
    return;
  }""",
        """  // Village theme
  if (theme.id === 'village') {
    setBackground(box, 'linear-gradient(rgba(10, 25, 41, 0.65), rgba(10, 25, 41, 0.65)), url(' + theme.url + ')', 'cover', 'no-repeat', '#0a1929');
    document.getElementById('current-bg-label').textContent = theme.label;
    _currentBgId = theme.id;
    localStorage.setItem('asterix_bg', theme.id);
    document.querySelectorAll('.bg-thumb').forEach(function(t) {
      t.classList.toggle('active', t.dataset.bgId === theme.id);
    });
    return;
  }

  // Default theme – use SVG pattern
  if (theme.id === 'default') {
    setBackground(box, DEFAULT_BG_PATTERN, '200px 200px', 'repeat', '#0a1929');
    document.getElementById('current-bg-label').textContent = 'Default pattern';
    _currentBgId = 'default';
    localStorage.setItem('asterix_bg', 'default');
    document.querySelectorAll('.bg-thumb').forEach(function(t) {
      t.classList.toggle('active', t.dataset.bgId === 'default');
    });
    return;
  }"""
    ),
    (
        "settings.js",
        "Update renderBgThumbs function",
        """    var cvs = document.createElement('canvas');
    var ctx = cvs.getContext('2d');
    theme.draw(ctx, cvs.width || 160, cvs.height || 100);
    var label = document.createElement('div');
    label.className = 'bg-thumb-label';
    label.textContent = theme.label;
    thumb.appendChild(cvs);""",
        """    if (theme.isImage) {
      var img = document.createElement('img');
      img.src = theme.url;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:8px;';
      thumb.appendChild(img);
    } else {
      var cvs = document.createElement('canvas');
      var ctx = cvs.getContext('2d');
      theme.draw(ctx, cvs.width || 160, cvs.height || 100);
      thumb.appendChild(cvs);
    }
    var label = document.createElement('div');
    label.className = 'bg-thumb-label';
    label.textContent = theme.label;"""
    ),
]

applied = skipped = failed = 0
for fname, desc, old, new in PATCHES:
    path = FILES[fname]
    text = path.read_text(encoding="utf-8")
    if new in text:
        print(f"  = {fname}: already patched — {desc}")
        skipped += 1
        continue
    if old not in text:
        print(f"  x {fname}: anchor not found — {desc}")
        failed += 1
        continue
    if DRY:
        print(f"  > {fname}: would patch — {desc}")
        applied += 1
        continue
    bak = path.with_suffix(path.suffix + ".bak")
    if not bak.exists():
        shutil.copy2(path, bak)
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"  + {fname}: patched — {desc}")
    applied += 1

print(f"\nSummary: applied={applied} skipped={skipped} failed={failed}")
sys.exit(0 if failed == 0 else 2)