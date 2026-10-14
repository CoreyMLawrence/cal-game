/**
 * Kaboom-Compatible Ultra-Lightweight Direct Canvas 2D Engine
 * Designed for Maximum 60 FPS Performance on Embedded Hardware (Raspberry Pi 4).
 * Zero External Dependencies.
 */
(function (global) {
  "use strict";

  // Virtual Canvas Internal Dimensions
  let _canvas = null;
  let _ctx = null;
  let _internalWidth = 960;
  let _internalHeight = 544;
  let _bgColor = "#87ceeb";
  let _gravity = 2400;

  // Camera
  let _camPos = null;
  let _camScale = 1;

  // Time & Loop
  let _time = 0;
  let _dt = 0;
  let _lastTimestamp = 0;
  let _isRunning = false;

  // Scenes & Objects
  const _scenes = new Map();
  let _currentScene = null;
  let _activeObjects = [];
  let _onUpdateCallbacks = [];
  let _onDrawCallbacks = [];
  let _sceneCancelHandlers = [];
  let _tweens = [];
  let _timers = [];
  let _nextObjId = 0;

  // Assets
  const _sprites = new Map();
  let _loadedCount = 0;
  let _expectedCount = 0;
  let _onLoadCallbacks = [];

  // Audio Context
  let _audioCtx = null;
  function getAudioCtx() {
    if (!_audioCtx && typeof window !== "undefined") {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        _audioCtx = new AudioCtxClass();
      }
    }
    return _audioCtx;
  }

  // Input
  const _keysDown = new Set();
  const _keyPressListeners = new Map();
  const _keyReleaseListeners = new Map();
  const _gamepadButtonPressListeners = new Map();
  const _gamepadButtonReleaseListeners = new Map();
  const _prevGamepadButtons = new Map();

  // -------------------------------------------------------------
  // Math & Geometry
  // -------------------------------------------------------------
  class Vec2 {
    constructor(x = 0, y = 0) {
      if (typeof x === "object" && x !== null) {
        this.x = Number(x.x) || 0;
        this.y = Number(x.y) || 0;
      } else {
        this.x = Number(x) || 0;
        this.y = y !== undefined ? Number(y) : this.x;
      }
    }
    clone() {
      return new Vec2(this.x, this.y);
    }
    add(x, y) {
      if (typeof x === "object" && x !== null) {
        return new Vec2(this.x + x.x, this.y + x.y);
      }
      return new Vec2(this.x + (x || 0), this.y + (y !== undefined ? y : (x || 0)));
    }
    sub(x, y) {
      if (typeof x === "object" && x !== null) {
        return new Vec2(this.x - x.x, this.y - x.y);
      }
      return new Vec2(this.x - (x || 0), this.y - (y !== undefined ? y : (x || 0)));
    }
    scale(s, sy) {
      if (typeof s === "object" && s !== null) {
        return new Vec2(this.x * s.x, this.y * s.y);
      }
      return new Vec2(this.x * s, this.y * (sy !== undefined ? sy : s));
    }
    dist(o) {
      return Math.hypot(this.x - o.x, this.y - o.y);
    }
    len() {
      return Math.hypot(this.x, this.y);
    }
    unit() {
      const l = this.len();
      return l === 0 ? new Vec2(0, 0) : new Vec2(this.x / l, this.y / l);
    }
    lerp(target, t) {
      const tx = typeof target === "object" ? target.x : target;
      const ty = typeof target === "object" ? target.y : target;
      return new Vec2(this.x + (tx - this.x) * t, this.y + (ty - this.y) * t);
    }
  }

  function vec2(x, y) {
    return new Vec2(x, y);
  }

  _camPos = vec2(480, 272);

  class Color {
    constructor(r = 255, g = 255, b = 255, a = 1) {
      this.r = r;
      this.g = g;
      this.b = b;
      this.a = a;
      this._css = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
    }
    toCss(overrideAlpha) {
      if (overrideAlpha !== undefined && overrideAlpha !== this.a) {
        return `rgba(${Math.round(this.r)},${Math.round(this.g)},${Math.round(this.b)},${overrideAlpha})`;
      }
      return this._css;
    }
  }

  function rgb(r, g, b) {
    return new Color(r, g, b, 1);
  }
  function rgba(r, g, b, a) {
    return new Color(r, g, b, a);
  }

  const UP = vec2(0, -1);
  const DOWN = vec2(0, 1);
  const LEFT = vec2(-1, 0);
  const RIGHT = vec2(1, 0);

  function rand(a, b) {
    if (a === undefined) return Math.random();
    if (b === undefined) return Math.random() * a;
    return a + Math.random() * (b - a);
  }
  function randi(a, b) {
    return Math.floor(rand(a, b));
  }
  function choose(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
  function mapVal(v, inMin, inMax, outMin, outMax) {
    return outMin + (outMax - outMin) * ((v - inMin) / (inMax - inMin));
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  const easings = Object.freeze({
    linear: (t) => t,
    easeInQuad: (t) => t * t,
    easeOutQuad: (t) => t * (2 - t),
    easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  });

  // -------------------------------------------------------------
  // Engine Lifecycle & Config
  // -------------------------------------------------------------
  function kaboom(opts = {}) {
    _canvas = opts.canvas || document.getElementById("game");
    if (!_canvas) throw new Error("Canvas element not found");

    _internalWidth = opts.width || 960;
    _internalHeight = opts.height || 544;
    _canvas.width = _internalWidth;
    _canvas.height = _internalHeight;

    _ctx = _canvas.getContext("2d", { alpha: false, desynchronized: true }) || _canvas.getContext("2d");
    if (_ctx) _ctx.imageSmoothingEnabled = false;

    if (opts.background) {
      if (Array.isArray(opts.background)) {
        _bgColor = `rgb(${opts.background[0]},${opts.background[1]},${opts.background[2]})`;
      } else {
        _bgColor = opts.background;
      }
    }

    _camPos = vec2(_internalWidth / 2, _internalHeight / 2);
    _setupInputListeners();

    if (!_isRunning) {
      _isRunning = true;
      requestAnimationFrame(_gameLoop);
    }
  }

  function width() {
    return _internalWidth;
  }
  function height() {
    return _internalHeight;
  }
  function camPos(p) {
    if (p !== undefined) {
      _camPos.x = p.x;
      _camPos.y = p.y;
    }
    return _camPos.clone();
  }
  function camScale(s) {
    if (s !== undefined) _camScale = s;
    return _camScale;
  }
  function setGravity(g) {
    _gravity = g;
  }
  function getGravity() {
    return _gravity;
  }
  function time() {
    return _time;
  }
  function dt() {
    return _dt;
  }

  // -------------------------------------------------------------
  // Storage
  // -------------------------------------------------------------
  function getData(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch (_) {
      return fallback;
    }
  }
  function setData(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  // -------------------------------------------------------------
  // Timers & Tweens
  // -------------------------------------------------------------
  function wait(sec, fn) {
    return new Promise((resolve) => {
      _timers.push({
        left: sec,
        resolve: () => {
          if (typeof fn === "function") fn();
          resolve();
        },
      });
    });
  }

  function loop(sec, fn) {
    let elapsed = 0;
    let cancelled = false;
    const l = {
      update(delta) {
        if (cancelled) return;
        elapsed += delta;
        if (elapsed >= sec) {
          elapsed = 0;
          fn();
        }
      },
      cancel() {
        cancelled = true;
      },
    };
    _onUpdateCallbacks.push(() => l.update(_dt));
    return {
      cancel() {
        l.cancel();
      },
    };
  }

  function tween(from, to, duration, updateFn, ease = easings.linear) {
    return new Promise((resolve) => {
      if (duration <= 0) {
        updateFn(to);
        resolve();
        return;
      }
      _tweens.push({
        from,
        to,
        duration,
        elapsed: 0,
        updateFn,
        ease,
        resolve,
      });
    });
  }

  // -------------------------------------------------------------
  // Assets & Sprites
  // -------------------------------------------------------------
  function loadSprite(name, src) {
    _expectedCount++;
    const img = new Image();
    img.onload = () => {
      _loadedCount++;
      _sprites.set(name, {
        img,
        width: img.naturalWidth || 32,
        height: img.naturalHeight || 32,
      });
      if (_loadedCount >= _expectedCount) {
        const cbs = _onLoadCallbacks.slice();
        _onLoadCallbacks = [];
        for (const cb of cbs) cb();
      }
    };
    img.onerror = () => {
      _loadedCount++;
      console.warn("Could not load sprite:", name, src);
      if (_loadedCount >= _expectedCount) {
        const cbs = _onLoadCallbacks.slice();
        _onLoadCallbacks = [];
        for (const cb of cbs) cb();
      }
    };
    img.src = src;
  }

  function onLoad(fn) {
    if (_expectedCount === 0 || _loadedCount >= _expectedCount) {
      setTimeout(fn, 0);
    } else {
      _onLoadCallbacks.push(fn);
    }
  }

  // -------------------------------------------------------------
  // Input System (Keyboard + Gamepad Polling)
  // -------------------------------------------------------------
  const KEY_NORMALIZE = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    " ": "space",
    Enter: "enter",
    Escape: "escape",
    Shift: "shift",
    Control: "control",
    Backspace: "backspace",
  };

  function _normalizeKey(key) {
    if (KEY_NORMALIZE[key]) return KEY_NORMALIZE[key];
    return key.toLowerCase();
  }

  function _setupInputListeners() {
    if (typeof window === "undefined") return;

    window.addEventListener("keydown", (e) => {
      const k = _normalizeKey(e.key);
      const wasDown = _keysDown.has(k);
      _keysDown.add(k);
      if (!wasDown) {
        const listeners = _keyPressListeners.get(k);
        if (listeners) {
          for (const fn of Array.from(listeners)) fn();
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      const k = _normalizeKey(e.key);
      _keysDown.delete(k);
      const listeners = _keyReleaseListeners.get(k);
      if (listeners) {
        for (const fn of Array.from(listeners)) fn();
      }
    });
  }

  function isKeyDown(key) {
    return _keysDown.has(_normalizeKey(key));
  }

  function onKeyPress(key, fn) {
    const k = _normalizeKey(key);
    if (!_keyPressListeners.has(k)) _keyPressListeners.set(k, new Set());
    _keyPressListeners.get(k).add(fn);
    const cancel = () => {
      const set = _keyPressListeners.get(k);
      if (set) set.delete(fn);
    };
    _sceneCancelHandlers.push(cancel);
    return { cancel };
  }

  function onKeyRelease(key, fn) {
    const k = _normalizeKey(key);
    if (!_keyReleaseListeners.has(k)) _keyReleaseListeners.set(k, new Set());
    _keyReleaseListeners.get(k).add(fn);
    const cancel = () => {
      const set = _keyReleaseListeners.get(k);
      if (set) set.delete(fn);
    };
    _sceneCancelHandlers.push(cancel);
    return { cancel };
  }

  const GAMEPAD_BUTTON_MAP = {
    0: "south",
    1: "east",
    2: "west",
    3: "north",
    4: "lshoulder",
    5: "rshoulder",
    6: "ltrigger",
    7: "rtrigger",
    8: "select",
    9: "start",
    12: "dpad-up",
    13: "dpad-down",
    14: "dpad-left",
    15: "dpad-right",
    16: "home",
  };

  function _pollGamepads() {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const padId = p.index;
      let prevButtons = _prevGamepadButtons.get(padId);
      if (!prevButtons) {
        prevButtons = new Map();
        _prevGamepadButtons.set(padId, prevButtons);
      }

      for (let btnIdx = 0; btnIdx < p.buttons.length; btnIdx++) {
        const btnName = GAMEPAD_BUTTON_MAP[btnIdx];
        if (!btnName) continue;
        const isPressed = !!p.buttons[btnIdx].pressed;
        const wasPressed = !!prevButtons.get(btnName);

        if (isPressed && !wasPressed) {
          const listeners = _gamepadButtonPressListeners.get(btnName);
          if (listeners) {
            for (const fn of Array.from(listeners)) fn();
          }
        } else if (!isPressed && wasPressed) {
          const listeners = _gamepadButtonReleaseListeners.get(btnName);
          if (listeners) {
            for (const fn of Array.from(listeners)) fn();
          }
        }
        prevButtons.set(btnName, isPressed);
      }
    }
  }

  function isGamepadButtonDown(btn) {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return false;
    const pads = navigator.getGamepads();
    for (const p of pads) {
      if (!p || !p.connected) continue;
      for (let i = 0; i < p.buttons.length; i++) {
        if (GAMEPAD_BUTTON_MAP[i] === btn && p.buttons[i].pressed) return true;
      }
    }
    return false;
  }

  function onGamepadButtonPress(btn, fn) {
    if (!_gamepadButtonPressListeners.has(btn)) {
      _gamepadButtonPressListeners.set(btn, new Set());
    }
    _gamepadButtonPressListeners.get(btn).add(fn);
    const cancel = () => {
      const set = _gamepadButtonPressListeners.get(btn);
      if (set) set.delete(fn);
    };
    _sceneCancelHandlers.push(cancel);
    return { cancel };
  }

  function onGamepadButtonRelease(btn, fn) {
    if (!_gamepadButtonReleaseListeners.has(btn)) {
      _gamepadButtonReleaseListeners.set(btn, new Set());
    }
    _gamepadButtonReleaseListeners.get(btn).add(fn);
    const cancel = () => {
      const set = _gamepadButtonReleaseListeners.get(btn);
      if (set) set.delete(fn);
    };
    _sceneCancelHandlers.push(cancel);
    return { cancel };
  }

  function getGamepadStick(name = "left") {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return vec2(0, 0);
    const pads = navigator.getGamepads();
    for (const p of pads) {
      if (!p || !p.connected) continue;
      if (name === "left" && p.axes.length >= 2) {
        return vec2(p.axes[0] || 0, p.axes[1] || 0);
      }
      if (name === "right" && p.axes.length >= 4) {
        return vec2(p.axes[2] || 0, p.axes[3] || 0);
      }
    }
    return vec2(0, 0);
  }

  // -------------------------------------------------------------
  // Immediate Mode 2D Canvas Drawing
  // -------------------------------------------------------------
  function _toScreenX(x, isFixed) {
    return isFixed ? x : (x - _camPos.x) * _camScale + _internalWidth / 2;
  }
  function _toScreenY(y, isFixed) {
    return isFixed ? y : (y - _camPos.y) * _camScale + _internalHeight / 2;
  }

  function _resolveColor(col, fallback = "#fff") {
    if (!col) return fallback;
    if (typeof col.toCss === "function") return col.toCss();
    if (typeof col === "string") return col;
    if (Array.isArray(col)) return `rgb(${col[0]},${col[1]},${col[2]})`;
    return fallback;
  }

  function drawRect(opts = {}) {
    if (!_ctx) return;
    const isFixed = !!opts.fixed;
    const x = _toScreenX(opts.pos?.x || 0, isFixed);
    const y = _toScreenY(opts.pos?.y || 0, isFixed);
    const w = (opts.width || 0) * (isFixed ? 1 : _camScale);
    const h = (opts.height || 0) * (isFixed ? 1 : _camScale);
    const alpha = opts.opacity !== undefined ? opts.opacity : 1;
    if (alpha <= 0 || w <= 0 || h <= 0) return;

    _ctx.save();
    _ctx.globalAlpha = alpha;

    if (opts.radius && typeof _ctx.roundRect === "function") {
      _ctx.beginPath();
      _ctx.roundRect(x, y, w, h, opts.radius * (isFixed ? 1 : _camScale));
      if (opts.fill !== false) {
        _ctx.fillStyle = _resolveColor(opts.color, "#fff");
        _ctx.fill();
      }
      if (opts.outline) {
        _ctx.strokeStyle = _resolveColor(opts.outline.color, "#000");
        _ctx.lineWidth = (opts.outline.width || 1) * (isFixed ? 1 : _camScale);
        _ctx.stroke();
      }
    } else {
      if (opts.fill !== false) {
        _ctx.fillStyle = _resolveColor(opts.color, "#fff");
        _ctx.fillRect(x, y, w, h);
      }
      if (opts.outline) {
        _ctx.strokeStyle = _resolveColor(opts.outline.color, "#000");
        _ctx.lineWidth = (opts.outline.width || 1) * (isFixed ? 1 : _camScale);
        _ctx.strokeRect(x, y, w, h);
      }
    }
    _ctx.restore();
  }

  function drawCircle(opts = {}) {
    if (!_ctx) return;
    const isFixed = !!opts.fixed;
    const x = _toScreenX(opts.pos?.x || 0, isFixed);
    const y = _toScreenY(opts.pos?.y || 0, isFixed);
    const r = (opts.radius || 0) * (isFixed ? 1 : _camScale);
    const alpha = opts.opacity !== undefined ? opts.opacity : 1;
    if (alpha <= 0 || r <= 0) return;

    _ctx.save();
    _ctx.globalAlpha = alpha;
    _ctx.beginPath();
    _ctx.arc(x, y, r, 0, Math.PI * 2);

    if (opts.fill !== false) {
      _ctx.fillStyle = _resolveColor(opts.color, "#fff");
      _ctx.fill();
    }
    if (opts.outline) {
      _ctx.strokeStyle = _resolveColor(opts.outline.color, "#000");
      _ctx.lineWidth = (opts.outline.width || 1) * (isFixed ? 1 : _camScale);
      _ctx.stroke();
    }
    _ctx.restore();
  }

  function drawEllipse(opts = {}) {
    if (!_ctx) return;
    const isFixed = !!opts.fixed;
    const x = _toScreenX(opts.pos?.x || 0, isFixed);
    const y = _toScreenY(opts.pos?.y || 0, isFixed);
    const rx = (opts.radiusX || 0) * (isFixed ? 1 : _camScale);
    const ry = (opts.radiusY || 0) * (isFixed ? 1 : _camScale);
    const alpha = opts.opacity !== undefined ? opts.opacity : 1;
    if (alpha <= 0 || rx <= 0 || ry <= 0) return;

    _ctx.save();
    _ctx.globalAlpha = alpha;
    _ctx.beginPath();
    if (typeof _ctx.ellipse === "function") {
      _ctx.ellipse(x, y, rx, ry, opts.angle || 0, 0, Math.PI * 2);
    } else {
      _ctx.arc(x, y, Math.min(rx, ry), 0, Math.PI * 2);
    }

    if (opts.fill !== false) {
      _ctx.fillStyle = _resolveColor(opts.color, "#fff");
      _ctx.fill();
    }
    if (opts.outline) {
      _ctx.strokeStyle = _resolveColor(opts.outline.color, "#000");
      _ctx.lineWidth = (opts.outline.width || 1) * (isFixed ? 1 : _camScale);
      _ctx.stroke();
    }
    _ctx.restore();
  }

  function drawPolygon(opts = {}) {
    if (!_ctx || !Array.isArray(opts.pts) || opts.pts.length < 3) return;
    const isFixed = !!opts.fixed;
    const alpha = opts.opacity !== undefined ? opts.opacity : 1;
    if (alpha <= 0) return;

    _ctx.save();
    _ctx.globalAlpha = alpha;
    _ctx.beginPath();
    const p0 = opts.pts[0];
    _ctx.moveTo(_toScreenX(p0.x, isFixed), _toScreenY(p0.y, isFixed));
    for (let i = 1; i < opts.pts.length; i++) {
      const p = opts.pts[i];
      _ctx.lineTo(_toScreenX(p.x, isFixed), _toScreenY(p.y, isFixed));
    }
    _ctx.closePath();

    if (opts.fill !== false) {
      _ctx.fillStyle = _resolveColor(opts.color, "#fff");
      _ctx.fill();
    }
    if (opts.outline) {
      _ctx.strokeStyle = _resolveColor(opts.outline.color, "#000");
      _ctx.lineWidth = (opts.outline.width || 1) * (isFixed ? 1 : _camScale);
      _ctx.stroke();
    }
    _ctx.restore();
  }

  function drawTriangle(opts = {}) {
    if (!opts.p1 || !opts.p2 || !opts.p3) return;
    drawPolygon({
      pts: [opts.p1, opts.p2, opts.p3],
      color: opts.color,
      opacity: opts.opacity,
      outline: opts.outline,
      fill: opts.fill,
      fixed: opts.fixed,
    });
  }

  function drawLine(opts = {}) {
    if (!_ctx || !opts.p1 || !opts.p2) return;
    const isFixed = !!opts.fixed;
    const alpha = opts.opacity !== undefined ? opts.opacity : 1;
    if (alpha <= 0) return;

    _ctx.save();
    _ctx.globalAlpha = alpha;
    _ctx.strokeStyle = _resolveColor(opts.color, "#fff");
    _ctx.lineWidth = (opts.width || 1) * (isFixed ? 1 : _camScale);
    _ctx.beginPath();
    _ctx.moveTo(_toScreenX(opts.p1.x, isFixed), _toScreenY(opts.p1.y, isFixed));
    _ctx.lineTo(_toScreenX(opts.p2.x, isFixed), _toScreenY(opts.p2.y, isFixed));
    _ctx.stroke();
    _ctx.restore();
  }

  function drawText(opts = {}) {
    if (!_ctx || opts.text === undefined || opts.text === null) return;
    const isFixed = !!opts.fixed;
    const str = String(opts.text);
    const size = (opts.size || 16) * (isFixed ? 1 : _camScale);
    const alpha = opts.opacity !== undefined ? opts.opacity : 1;
    if (alpha <= 0) return;

    _ctx.save();
    _ctx.globalAlpha = alpha;
    _ctx.font = `bold ${Math.round(size)}px monospace, sans-serif`;
    _ctx.fillStyle = _resolveColor(opts.color, "#fff");
    _ctx.textAlign = opts.align === "center" ? "center" : opts.align === "right" ? "right" : "left";
    _ctx.textBaseline = "top";

    const lines = str.split("\n");
    const lineH = size + (opts.lineSpacing || 4) * (isFixed ? 1 : _camScale);
    let startY = _toScreenY(opts.pos?.y || 0, isFixed);
    const x = _toScreenX(opts.pos?.x || 0, isFixed);

    for (let i = 0; i < lines.length; i++) {
      _ctx.fillText(lines[i], x, startY + i * lineH);
    }
    _ctx.restore();
  }

  function drawSprite(opts = {}) {
    if (!_ctx || !opts.sprite) return;
    const sp = _sprites.get(opts.sprite);
    if (!sp || !sp.img) return;

    const isFixed = !!opts.fixed;
    const alpha = opts.opacity !== undefined ? opts.opacity : 1;
    if (alpha <= 0) return;

    const scaleX = (opts.scale?.x !== undefined ? opts.scale.x : (typeof opts.scale === "number" ? opts.scale : 1));
    const scaleY = (opts.scale?.y !== undefined ? opts.scale.y : (typeof opts.scale === "number" ? opts.scale : 1));
    const w = (opts.width || sp.width || 32) * scaleX * (isFixed ? 1 : _camScale);
    const h = (opts.height || sp.height || 32) * scaleY * (isFixed ? 1 : _camScale);

    let x = _toScreenX(opts.pos?.x || 0, isFixed);
    let y = _toScreenY(opts.pos?.y || 0, isFixed);

    if (opts.anchor === "center") {
      x -= w / 2;
      y -= h / 2;
    }

    _ctx.save();
    _ctx.globalAlpha = alpha;

    if (opts.flipX || opts.angle) {
      _ctx.translate(x + w / 2, y + h / 2);
      if (opts.flipX) _ctx.scale(-1, 1);
      if (opts.angle) _ctx.rotate((opts.angle * Math.PI) / 180);
      _ctx.drawImage(sp.img, -w / 2, -h / 2, w, h);
    } else {
      _ctx.drawImage(sp.img, x, y, w, h);
    }
    _ctx.restore();
  }

  // -------------------------------------------------------------
  // Game Objects & Components
  // -------------------------------------------------------------
  class GameObject {
    constructor(comps = []) {
      this.id = ++_nextObjId;
      this.tags = new Set();
      this.components = [];
      this.pos = vec2(0, 0);
      this.scale = vec2(1, 1);
      this.angle = 0;
      this.color = rgb(255, 255, 255);
      this.opacity = 1;
      this.z = 0;
      this.fixed = false;
      this.hidden = false;
      this.flipX = false;
      this.flipY = false;
      this.destroyed = false;
      this.events = new Map();
      this.solidEnabled = true;

      for (const comp of comps) {
        this.use(comp);
      }
    }

    is(tag) {
      return this.tags.has(tag);
    }

    on(ev, fn) {
      if (!this.events.has(ev)) this.events.set(ev, new Set());
      this.events.get(ev).add(fn);
      return {
        cancel: () => {
          const set = this.events.get(ev);
          if (set) set.delete(fn);
        },
      };
    }

    trigger(ev, ...args) {
      const set = this.events.get(ev);
      if (set) {
        for (const fn of Array.from(set)) fn(...args);
      }
    }

    onUpdate(fn) {
      if (!this._updateCallbacks) this._updateCallbacks = [];
      this._updateCallbacks.push(fn);
      return {
        cancel: () => {
          const idx = this._updateCallbacks.indexOf(fn);
          if (idx !== -1) this._updateCallbacks.splice(idx, 1);
        },
      };
    }

    onCollide(tag, fn) {
      if (!this._collisionListeners) this._collisionListeners = new Map();
      if (!this._collisionListeners.has(tag)) this._collisionListeners.set(tag, new Set());
      this._collisionListeners.get(tag).add(fn);
      return {
        cancel: () => {
          const set = this._collisionListeners.get(tag);
          if (set) set.delete(fn);
        },
      };
    }

    use(comp) {
      if (!comp) return;
      if (typeof comp === "string") {
        this.tags.add(comp);
        return;
      }
      if (Array.isArray(comp)) {
        for (const c of comp) this.use(c);
        return;
      }
      if (comp.tags) {
        for (const t of comp.tags) this.tags.add(t);
      }
      Object.assign(this, comp);
      this.components.push(comp);
      if (typeof comp.add === "function") {
        comp.add.call(this);
      }
    }

    unuse(tagOrId) {
      this.tags.delete(tagOrId);
      const idx = this.components.findIndex((c) => c.id === tagOrId);
      if (idx !== -1) {
        const comp = this.components[idx];
        if (typeof comp.destroy === "function") comp.destroy.call(this);
        this.components.splice(idx, 1);
      }
    }

    worldArea() {
      const areaComp = this.components.find((c) => c.id === "area") || this;
      const sx = (areaComp.areaScale?.x ?? 1) * (this.scale?.x ?? 1);
      const sy = (areaComp.areaScale?.y ?? 1) * (this.scale?.y ?? 1);
      const ox = (areaComp.areaOffset?.x ?? 0) * (this.scale?.x ?? 1);
      const oy = (areaComp.areaOffset?.y ?? 0) * (this.scale?.y ?? 1);
      const baseW = this.width || 32;
      const baseH = this.height || 32;
      const w = baseW * sx;
      const h = baseH * sy;
      return {
        bbox: () => ({
          pos: vec2(this.pos.x + ox, this.pos.y + oy),
          width: w,
          height: h,
        }),
      };
    }

    exists() {
      return !this.destroyed;
    }

    destroy() {
      destroy(this);
    }
  }

  function add(comps = []) {
    const obj = new GameObject(comps);
    _activeObjects.push(obj);
    return obj;
  }

  function destroy(obj) {
    if (!obj || obj.destroyed) return;
    obj.destroyed = true;
    for (const comp of obj.components) {
      if (typeof comp.destroy === "function") comp.destroy.call(obj);
    }
    const idx = _activeObjects.indexOf(obj);
    if (idx !== -1) _activeObjects.splice(idx, 1);
  }

  function readd(obj) {
    if (!obj) return;
    const idx = _activeObjects.indexOf(obj);
    if (idx !== -1) {
      _activeObjects.splice(idx, 1);
      _activeObjects.push(obj);
    }
  }

  function get(tag) {
    if (!tag) return _activeObjects.slice();
    return _activeObjects.filter((o) => !o.destroyed && o.is(tag));
  }

  function every(tag, fn) {
    const list = get(tag);
    for (const o of list) fn(o);
  }

  function onUpdate(fn) {
    _onUpdateCallbacks.push(fn);
    const cancel = () => {
      const idx = _onUpdateCallbacks.indexOf(fn);
      if (idx !== -1) _onUpdateCallbacks.splice(idx, 1);
    };
    _sceneCancelHandlers.push(cancel);
    return { cancel };
  }

  function onDraw(fn) {
    _onDrawCallbacks.push(fn);
    const cancel = () => {
      const idx = _onDrawCallbacks.indexOf(fn);
      if (idx !== -1) _onDrawCallbacks.splice(idx, 1);
    };
    _sceneCancelHandlers.push(cancel);
    return { cancel };
  }

  // -------------------------------------------------------------
  // Component Constructors
  // -------------------------------------------------------------
  function pos(x = 0, y = 0) {
    return {
      id: "pos",
      pos: typeof x === "object" && x !== null ? x.clone() : vec2(x, y),
    };
  }

  function scale(sx = 1, sy = sx) {
    return {
      id: "scale",
      scale: typeof sx === "object" && sx !== null ? sx.clone() : vec2(sx, sy),
    };
  }

  function rotate(deg = 0) {
    return {
      id: "rotate",
      angle: deg,
    };
  }

  function color(r = 255, g = 255, b = 255, a = 1) {
    return {
      id: "color",
      color: typeof r === "object" && r !== null ? r : rgba(r, g, b, a),
    };
  }

  function opacity(a = 1) {
    return {
      id: "opacity",
      opacity: a,
    };
  }

  function z(idx = 0) {
    return {
      id: "z",
      z: idx,
    };
  }

  function anchor(name = "topleft") {
    return {
      id: "anchor",
      anchor: name,
    };
  }
  const origin = anchor;

  function fixed() {
    return {
      id: "fixed",
      fixed: true,
    };
  }

  function move(dir, speed) {
    return {
      id: "move",
      update() {
        if (dir && speed) {
          this.pos.x += dir.x * speed * dt();
          this.pos.y += dir.y * speed * dt();
        }
      },
    };
  }

  function lifespan(timeVal, opts = {}) {
    let elapsed = 0;
    const fade = opts.fade || 0;
    return {
      id: "lifespan",
      update() {
        elapsed += dt();
        if (fade > 0 && elapsed >= timeVal - fade) {
          const fadeProgress = (elapsed - (timeVal - fade)) / fade;
          this.opacity = Math.max(0, 1 - fadeProgress);
        }
        if (elapsed >= timeVal) {
          destroy(this);
        }
      },
    };
  }

  function area(opts = {}) {
    return {
      id: "area",
      areaScale: opts.scale ? (typeof opts.scale === "object" ? opts.scale.clone() : vec2(opts.scale, opts.scale)) : vec2(1, 1),
      areaOffset: opts.offset ? opts.offset.clone() : vec2(0, 0),
    };
  }

  function body(opts = {}) {
    return {
      id: "body",
      isStatic: !!opts.isStatic,
      vel: vec2(0, 0),
      gravityScale: opts.gravityScale !== undefined ? opts.gravityScale : 1,
      isGrounded() {
        if (typeof this._grounded === "boolean") return this._grounded;
        return true;
      },
      isFalling() {
        return (this.vel?.y || 0) > 0;
      },
      isJumping() {
        return (this.vel?.y || 0) < 0;
      },
      jump(f) {
        if (this.vel) this.vel.y = -f;
      },
      move(vx, vy) {
        if (typeof vx === "object" && vx !== null) {
          this.pos.x += vx.x * dt();
          this.pos.y += vx.y * dt();
        } else {
          this.pos.x += (vx || 0) * dt();
          this.pos.y += (vy || 0) * dt();
        }
      },
      update() {
        if (this.isStatic) return;
        if (this.vel) {
          if (!this.is("player")) {
            this.pos.x += this.vel.x * dt();
            this.pos.y += this.vel.y * dt();
          }
        }
      },
    };
  }

  function solid() {
    return {
      id: "solid",
      tags: ["solid"],
      solidEnabled: true,
    };
  }

  function rect(w, h, opts = {}) {
    return {
      id: "rect",
      width: w,
      height: h,
      radius: opts.radius || 0,
      draw() {
        drawRect({
          pos: this.pos,
          width: this.width,
          height: this.height,
          radius: this.radius,
          color: this.color,
          opacity: this.opacity,
          anchor: this.anchor,
          fixed: this.fixed,
        });
      },
    };
  }

  function circle(r, opts = {}) {
    return {
      id: "circle",
      radius: r,
      draw() {
        drawCircle({
          pos: this.pos,
          radius: this.radius,
          color: this.color,
          opacity: this.opacity,
          anchor: this.anchor,
          fixed: this.fixed,
        });
      },
    };
  }

  function sprite(name, opts = {}) {
    return {
      id: "sprite",
      sprite: name,
      width: opts.width || 32,
      height: opts.height || 32,
      draw() {
        drawSprite({
          sprite: this.sprite,
          pos: this.pos,
          width: this.width,
          height: this.height,
          scale: this.scale,
          flipX: this.flipX,
          flipY: this.flipY,
          angle: this.angle,
          opacity: this.opacity,
          anchor: this.anchor,
          fixed: this.fixed,
        });
      },
    };
  }

  function text(content, opts = {}) {
    return {
      id: "text",
      text: content,
      size: opts.size || 16,
      width: opts.width,
      lineSpacing: opts.lineSpacing || 4,
      align: opts.align || "left",
      draw() {
        let drawX = this.pos.x;
        let drawY = this.pos.y;
        if (this.anchor === "center") {
          // Centered text
          drawText({
            text: this.text,
            pos: vec2(drawX, drawY - this.size / 2),
            size: this.size,
            color: this.color,
            opacity: this.opacity,
            align: "center",
            width: this.width,
            lineSpacing: this.lineSpacing,
            fixed: this.fixed,
          });
        } else {
          drawText({
            text: this.text,
            pos: vec2(drawX, drawY),
            size: this.size,
            color: this.color,
            opacity: this.opacity,
            align: this.align,
            width: this.width,
            lineSpacing: this.lineSpacing,
            fixed: this.fixed,
          });
        }
      },
    };
  }

  function outline(w = 1, col = rgb(0, 0, 0)) {
    return {
      id: "outline",
      outline: {
        width: w,
        color: col,
      },
    };
  }

  // -------------------------------------------------------------
  // Ultra-Fast Spatial Tilemap Builder (addLevel)
  // -------------------------------------------------------------
  function addLevel(mapStrings, cfg = {}) {
    const tileWidth = cfg.tileWidth || 32;
    const tileHeight = cfg.tileHeight || 32;
    const rows = mapStrings.length;
    const cols = mapStrings[0].length;
    const tileMap = cfg.tiles || {};

    const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => []));

    const level = {
      tileWidth,
      tileHeight,
      cols,
      rows,
      numColumns: () => cols,
      numRows: () => rows,
      levelWidth: () => cols * tileWidth,
      levelHeight: () => rows * tileHeight,
      tile2Pos: (t) => vec2(t.x * tileWidth, t.y * tileHeight),
      pos2Tile: (p) => vec2(Math.floor(p.x / tileWidth), Math.floor(p.y / tileHeight)),
      getAt: (t) => {
        const tx = Math.floor(t.x);
        const ty = Math.floor(t.y);
        if (ty < 0 || ty >= rows || tx < 0 || tx >= cols) return [];
        return grid[ty][tx].filter((o) => !o.destroyed);
      },
      spawn: (comps, tilePos) => {
        const obj = add(comps);
        if (tilePos) {
          obj.pos = level.tile2Pos(tilePos);
          obj.tilePos = tilePos.clone();
          const tx = Math.floor(tilePos.x);
          const ty = Math.floor(tilePos.y);
          if (ty >= 0 && ty < rows && tx >= 0 && tx < cols) {
            grid[ty][tx].push(obj);
          }
        }
        return obj;
      },
    };

    for (let y = 0; y < rows; y++) {
      const line = mapStrings[y];
      for (let x = 0; x < cols; x++) {
        const ch = line[x];
        if (ch === " ") continue;
        const builder = tileMap[ch];
        if (!builder) continue;
        const tilePos = vec2(x, y);
        const res = builder(tilePos);
        if (!res) continue;

        const obj = add(res);
        obj.pos = level.tile2Pos(tilePos);
        obj.tilePos = tilePos;
        grid[y][x].push(obj);
      }
    }

    return level;
  }

  // -------------------------------------------------------------
  // Scene Management
  // -------------------------------------------------------------
  function scene(name, setupFn) {
    _scenes.set(name, setupFn);
  }

  function go(name, data) {
    for (const cancel of _sceneCancelHandlers) {
      try {
        cancel();
      } catch (_) {}
    }
    _sceneCancelHandlers = [];
    _activeObjects = [];
    _onUpdateCallbacks = [];
    _onDrawCallbacks = [];
    _tweens = [];
    _timers = [];
    _camPos = vec2(_internalWidth / 2, _internalHeight / 2);
    _camScale = 1;

    const setupFn = _scenes.get(name);
    if (!setupFn) {
      console.error("Unknown scene:", name);
      return;
    }
    _currentScene = name;
    setupFn(data);
  }

  // -------------------------------------------------------------
  // Master Game Loop
  // -------------------------------------------------------------
  function _gameLoop(timestamp) {
    requestAnimationFrame(_gameLoop);
    if (!_lastTimestamp) _lastTimestamp = timestamp;
    let rawDelta = (timestamp - _lastTimestamp) / 1000;
    _lastTimestamp = timestamp;
    if (rawDelta > 0.05) rawDelta = 0.05; // clamp to 50ms maximum step
    _dt = rawDelta;
    _time += _dt;

    // 1. Poll Gamepads
    _pollGamepads();

    // 2. Update Timers
    for (let i = _timers.length - 1; i >= 0; i--) {
      const tm = _timers[i];
      tm.left -= _dt;
      if (tm.left <= 0) {
        _timers.splice(i, 1);
        tm.resolve();
      }
    }

    // 3. Update Tweens
    for (let i = _tweens.length - 1; i >= 0; i--) {
      const tw = _tweens[i];
      tw.elapsed += _dt;
      const progress = Math.min(1, tw.elapsed / tw.duration);
      const eased = tw.ease(progress);
      const current = tw.from + (tw.to - tw.from) * eased;
      tw.updateFn(current);
      if (progress >= 1) {
        _tweens.splice(i, 1);
        tw.resolve();
      }
    }

    // 4. Update Game Objects
    for (let i = 0; i < _activeObjects.length; i++) {
      const obj = _activeObjects[i];
      if (obj.destroyed) continue;
      for (let j = 0; j < obj.components.length; j++) {
        const comp = obj.components[j];
        if (typeof comp.update === "function") {
          comp.update.call(obj);
        }
      }
      if (obj._updateCallbacks) {
        for (let k = 0; k < obj._updateCallbacks.length; k++) {
          obj._updateCallbacks[k].call(obj);
        }
      }
    }

    // 4b. Evaluate Collision Listeners
    for (let i = 0; i < _activeObjects.length; i++) {
      const obj = _activeObjects[i];
      if (obj.destroyed || !obj._collisionListeners) continue;
      const boxA = obj.worldArea().bbox();
      for (const [tag, listeners] of obj._collisionListeners.entries()) {
        const targets = get(tag);
        for (let t = 0; t < targets.length; t++) {
          const other = targets[t];
          if (other === obj || other.destroyed || other.hidden) continue;
          const boxB = other.worldArea().bbox();
          if (
            boxA.pos.x < boxB.pos.x + boxB.width &&
            boxA.pos.x + boxA.width > boxB.pos.x &&
            boxA.pos.y < boxB.pos.y + boxB.height &&
            boxA.pos.y + boxA.height > boxB.pos.y
          ) {
            const isBottom =
              boxA.pos.y + boxA.height * 0.75 <= boxB.pos.y + 14 ||
              (obj.vel && obj.vel.y >= -20 && boxA.pos.y < boxB.pos.y);
            const isTop = boxA.pos.y >= boxB.pos.y + boxB.height * 0.5;
            const isLeft = boxA.pos.x < boxB.pos.x;
            const isRight = boxA.pos.x > boxB.pos.x;
            const col = {
              target: other,
              isBottom: () => isBottom,
              isTop: () => isTop,
              isLeft: () => isLeft,
              isRight: () => isRight,
            };
            for (const fn of Array.from(listeners)) {
              fn(other, col);
            }
          }
        }
      }
    }

    // 5. Run Scene Update Callbacks
    for (let i = 0; i < _onUpdateCallbacks.length; i++) {
      _onUpdateCallbacks[i]();
    }

    // 6. Clean Destroyed Objects
    _activeObjects = _activeObjects.filter((o) => !o.destroyed);

    // 7. Render Everything
    _render();
  }

  function _render() {
    if (!_ctx) return;

    // Clear background
    _ctx.fillStyle = _bgColor;
    _ctx.fillRect(0, 0, _internalWidth, _internalHeight);

    // Run onDraw callbacks (background layers, custom scene passes)
    for (let i = 0; i < _onDrawCallbacks.length; i++) {
      _onDrawCallbacks[i]();
    }

    // Sort objects by z-index
    _activeObjects.sort((a, b) => (a.z || 0) - (b.z || 0));

    // Draw active game objects
    const halfW = _internalWidth / 2 / _camScale;
    const minX = _camPos.x - halfW - 64;
    const maxX = _camPos.x + halfW + 64;

    for (let i = 0; i < _activeObjects.length; i++) {
      const obj = _activeObjects[i];
      if (obj.destroyed || obj.hidden) continue;

      // Spatial viewport culling for world objects
      if (!obj.fixed && !obj.draw) {
        if (obj.pos.x < minX || obj.pos.x > maxX) continue;
      }

      // Draw object components
      for (let j = 0; j < obj.components.length; j++) {
        const comp = obj.components[j];
        if (typeof comp.draw === "function") {
          comp.draw.call(obj);
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Global Exports (Kaboom API)
  // -------------------------------------------------------------
  const API = {
    kaboom,
    scene,
    go,
    add,
    destroy,
    readd,
    get,
    every,
    onUpdate,
    onDraw,
    onKeyPress,
    onKeyRelease,
    isKeyDown,
    onGamepadButtonPress,
    onGamepadButtonRelease,
    isGamepadButtonDown,
    getGamepadStick,
    width,
    height,
    time,
    dt,
    camPos,
    camScale,
    vec2,
    rgb,
    rgba,
    rand,
    randi,
    choose,
    clamp,
    map: mapVal,
    lerp,
    wait,
    loop,
    tween,
    easings,
    drawRect,
    drawCircle,
    drawEllipse,
    drawPolygon,
    drawTriangle,
    drawLine,
    drawText,
    drawSprite,
    setGravity,
    getGravity,
    loadSprite,
    getData,
    setData,
    onLoad,
    addLevel,
    pos,
    scale,
    rotate,
    color,
    opacity,
    z,
    anchor,
    origin,
    fixed,
    move,
    lifespan,
    area,
    body,
    solid,
    rect,
    circle,
    sprite,
    text,
    outline,
    UP,
    DOWN,
    LEFT,
    RIGHT,
  };

  // Attach to global window
  Object.assign(global, API);
  Object.defineProperty(global, "audioCtx", {
    get: getAudioCtx,
    configurable: true,
    enumerable: true,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = API;
  }
})(typeof window !== "undefined" ? window : globalThis);
