"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ─────────────────────────────────────────────────────────────────────────
// ShiftBackground
// ─────────────────────────────────────────────────────────────────────────
// Perf-tuned pass. The previous version's cost was dominated by two things:
//   1. A full-viewport `filter: blur()` at BLUR_PX * dpr — canvas blur cost
//      scales with both pixel count AND radius, so a 110px blur at dpr=2
//      (220px effective radius, 4x the pixel count of dpr=1) was by far the
//      single most expensive operation per frame.
//   2. 130 circles each doing createRadialGradient + arc().fill() every
//      frame, uncapped to display refresh rate (60/120/144hz+).
// Fixes here: lower circle count, lower blur radius, lower DPR ceiling, an
// explicit frame-rate cap (this kind of soft blurred wash doesn't need 60fps
// to read as smooth), and hard bail-outs for reduced-motion / hidden tabs.
// Visual character is basically unchanged — just cheaper to keep running.
// ─────────────────────────────────────────────────────────────────────────

const CIRCLE_COUNT = 55; // was 130
const BASE_SPEED = 0.08;
const RANGE_SPEED = 0.55;
const BASE_TTL = 220;
const RANGE_TTL = 260;
const BASE_RADIUS = 150;
const RANGE_RADIUS = 220;

const HUE_CENTER = 280;
const HUE_SWING = 35;
const HUE_OSCILLATION_SPEED = 0.0025;

const POS_SCALE = 0.0016;
const BACKGROUND = "hsl(262, 45%, 97%)";
const BLUR_PX = 60; // was 110 — the single biggest cost lever
const FILL_ALPHA_CAP = 0.4;
const MAX_DPR = 1.5; // was 2 — 2x DPR = 4x pixels for the blur pass to chew through

const TARGET_FPS = 30; // was uncapped — this background doesn't need 60/120hz
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

const TAU = Math.PI * 2;
const rand = (n: number) => n * Math.random();
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function fadeInOut(life: number, ttl: number) {
  const half = ttl * 0.5;
  return Math.abs(((life + half) % ttl) - half) / half;
}

function pseudoNoise(x: number, y: number, z: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

type CircleProps = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  radius: number;
  hue: number;
};

function makeCircle(width: number, height: number, hue: number): CircleProps {
  const x = rand(width);
  const y = rand(height);
  const n = pseudoNoise(x * POS_SCALE, y * POS_SCALE, hue * POS_SCALE);
  const t = rand(TAU);
  const speed = BASE_SPEED + rand(RANGE_SPEED);

  return {
    x,
    y,
    vx: speed * Math.cos(t),
    vy: speed * Math.sin(t),
    life: 0,
    ttl: BASE_TTL + rand(RANGE_TTL),
    radius: BASE_RADIUS + rand(RANGE_RADIUS),
    hue: clamp(hue + n * (HUE_SWING * 0.5), HUE_CENTER - HUE_SWING, HUE_CENTER + HUE_SWING),
  };
}

export function ShiftBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!mounted) return;
    const visible = canvasRef.current;
    if (!visible) return;

    // Respect the OS-level "reduce motion" setting: render one static frame
    // and stop. Also just cheaper for anyone who has this on.
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const raw = document.createElement("canvas");
    const ctxVisible = visible.getContext("2d");
    const ctxRaw = raw.getContext("2d");
    if (!ctxVisible || !ctxRaw) return;

    let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    let width = window.innerWidth;
    let height = window.innerHeight;
    let circles: CircleProps[] = [];
    let frame = 0;
    let rafId = 0;
    let lastFrameTime = 0;

    function currentHue() {
      return HUE_CENTER + Math.sin(frame * HUE_OSCILLATION_SPEED) * HUE_SWING;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = window.innerWidth;
      height = window.innerHeight;

      visible!.width = width * dpr;
      visible!.height = height * dpr;
      raw.width = width * dpr;
      raw.height = height * dpr;

      ctxRaw!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxVisible!.setTransform(1, 0, 0, 1, 0, 0);
    }

    function initCircles() {
      const hue = currentHue();
      circles = Array.from({ length: CIRCLE_COUNT }, () =>
        makeCircle(width, height, hue)
      );
    }

    function outOfBounds(c: CircleProps) {
      return (
        c.x < -c.radius ||
        c.x > width + c.radius ||
        c.y < -c.radius ||
        c.y > height + c.radius
      );
    }

    function renderFrame() {
      ctxRaw!.clearRect(0, 0, width, height);

      frame++;
      const hue = currentHue();

      for (let i = 0; i < circles.length; i++) {
        const c = circles[i];
        const alpha = fadeInOut(c.life, c.ttl) * FILL_ALPHA_CAP;

        const grad = ctxRaw!.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.radius);
        grad.addColorStop(0, `hsla(${c.hue}, 78%, 60%, ${alpha})`);
        grad.addColorStop(1, `hsla(${c.hue}, 78%, 60%, 0)`);

        ctxRaw!.beginPath();
        ctxRaw!.fillStyle = grad;
        ctxRaw!.arc(c.x, c.y, c.radius, 0, TAU);
        ctxRaw!.fill();

        if (!prefersReducedMotion) {
          c.life++;
          c.x += c.vx;
          c.y += c.vy;

          if (outOfBounds(c) || c.life > c.ttl) {
            circles[i] = makeCircle(width, height, hue);
          }
        }
      }

      ctxVisible!.fillStyle = BACKGROUND;
      ctxVisible!.fillRect(0, 0, visible!.width, visible!.height);

      ctxVisible!.save();
      ctxVisible!.filter = `blur(${BLUR_PX * dpr}px)`;
      ctxVisible!.drawImage(raw, 0, 0, visible!.width, visible!.height);
      ctxVisible!.restore();
    }

    function draw(now: number) {
      // Frame-rate cap: skip the (expensive) render work entirely unless
      // enough time has passed, instead of redrawing on every rAF tick.
      if (now - lastFrameTime >= FRAME_INTERVAL_MS) {
        lastFrameTime = now;
        renderFrame();
      }
      rafId = window.requestAnimationFrame(draw);
    }

    function handleResize() {
      resize();
      initCircles();
      renderFrame();
    }

    function handleVisibilityChange() {
      // Defensive: some environments (PWA wrappers, certain browsers) don't
      // reliably throttle rAF in background tabs on their own.
      if (document.hidden) {
        window.cancelAnimationFrame(rafId);
      } else {
        lastFrameTime = 0;
        rafId = window.requestAnimationFrame(draw);
      }
    }

    resize();
    initCircles();
    renderFrame(); // draw the first frame synchronously

    if (!prefersReducedMotion) {
      rafId = window.requestAnimationFrame(draw);
    }

    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.35,
          backgroundImage:
            "radial-gradient(circle, #a1a1aa 0.8px, transparent 0.8px)",
          backgroundSize: "22px 22px",
        }}
      />
    </div>,
    document.body
  );
}