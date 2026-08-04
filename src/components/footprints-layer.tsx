"use client";

import { useEffect, useRef } from "react";

const STRIDE = 72;
const HALF_STRIDE = STRIDE / 2;
const STEP_MS = 1200;
const FADE_IN_MS = 220;
const HOLD_MS = 480;
const FADE_END_MS = 1320;
const LATERAL = 16;
const PRINT_W = 34;
const MAX_OPACITY = 0.5;
const SPLAY = 14;
const PATH_INSET = 12;
const Y_TOP = 120;
const Y_BOTTOM_GAP = 96;

export function FootprintsLayer() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const buildPrint = (foot: "left" | "right") => {
      const el = document.createElement("div");
      el.className = `footprint foot-${foot}`;
      el.innerHTML = `
        <span class="footprint-toe t1"></span>
        <span class="footprint-toe t2"></span>
        <span class="footprint-toe t3"></span>
        <span class="footprint-toe t4"></span>
        <span class="footprint-sole"></span>
        <span class="footprint-heel"></span>
      `;
      return el;
    };

    const leftEl = buildPrint("left");
    const rightEl = buildPrint("right");
    layer.append(leftEl, rightEl);

    const walker = {
      dir: 1,
      cx: -90,
      gaitMs: 0,
      n: 0,
    };

    const diag = () => {
      const vw = window.innerWidth;
      const x0 = PATH_INSET;
      const y0 = Y_TOP;
      const x1 = vw - PATH_INSET;
      const y1 = Math.max(
        y0 + 200,
        document.documentElement.scrollHeight - Y_BOTTOM_GAP,
      );
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      return { x0, y0, x1, y1, ux: dx / len, uy: dy / len };
    };

    const footOpacity = (phase: number) => {
      if (phase >= FADE_END_MS) return 0;
      if (phase < FADE_IN_MS) return phase / FADE_IN_MS;
      if (phase < FADE_IN_MS + HOLD_MS) return 1;
      return (
        1 -
        (phase - FADE_IN_MS - HOLD_MS) / (FADE_END_MS - FADE_IN_MS - HOLD_MS)
      );
    };

    let lastFrame = 0;
    let rafId = 0;

    const tick = (now: number) => {
      const dt = Math.min(lastFrame ? now - lastFrame : 16, 48);
      lastFrame = now;

      const { x0, y0, x1, y1, ux, uy } = diag();

      walker.gaitMs += dt;
      while (walker.gaitMs >= STEP_MS) {
        walker.gaitMs -= STEP_MS;
        walker.n += 1;
        const front = walker.cx + walker.dir * (HALF_STRIDE + PRINT_W / 2) * ux;
        if (walker.dir === 1 ? front >= x1 : front <= x0) {
          walker.dir *= -1;
        } else {
          walker.cx += walker.dir * HALF_STRIDE * ux;
        }
      }

      const cy = y0 + ((walker.cx - x0) / (x1 - x0)) * (y1 - y0);

      const lastFoot = walker.n % 2;
      const leftPhase = walker.gaitMs + (lastFoot === 0 ? 0 : STEP_MS);
      const rightPhase = walker.gaitMs + (lastFoot === 1 ? 0 : STEP_MS);

      leftEl.style.opacity = String(footOpacity(leftPhase) * MAX_OPACITY);
      rightEl.style.opacity = String(footOpacity(rightPhase) * MAX_OPACITY);

      const perpX = -uy;
      const perpY = ux;
      const place = (
        el: HTMLElement,
        along: number,
        across: number,
      ) => {
        el.style.left = `${walker.cx + walker.dir * along * ux + across * perpX}px`;
        el.style.top = `${cy + walker.dir * along * uy + across * perpY}px`;
      };
      place(leftEl, lastFoot === 0 ? HALF_STRIDE : -HALF_STRIDE, -LATERAL / 2);
      place(rightEl, lastFoot === 1 ? HALF_STRIDE : -HALF_STRIDE, LATERAL / 2);

      const travelAngle =
        90 + (Math.atan2(walker.dir * uy, walker.dir * ux) * 180) / Math.PI;
      leftEl.style.transform = `rotate(${travelAngle - SPLAY}deg)`;
      rightEl.style.transform = `rotate(${travelAngle + SPLAY}deg)`;

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      leftEl.remove();
      rightEl.remove();
    };
  }, []);

  return (
    <div
      className="footprints-layer"
      id="footprints-layer"
      ref={layerRef}
      aria-hidden="true"
    />
  );
}