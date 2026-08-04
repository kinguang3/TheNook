"use client";

import { useEffect, useRef } from "react";

function createDrop(width: number, height: number, resetAbove = false) {
  return {
    x: Math.random() * width,
    y: resetAbove ? Math.random() * -height * 0.2 : Math.random() * height,
    length: 10 + Math.random() * 16,
    speed: 3.8 + Math.random() * 4.6,
    wind: 1 + Math.random() * 1.4,
    alpha: 0.08 + Math.random() * 0.18,
  };
}

function debounce(callback: () => void, wait: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(callback, wait);
  };
}

export function RainLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let animationId = 0;
    let width = 0;
    let height = 0;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const drops: ReturnType<typeof createDrop>[] = [];

    const buildDrops = () => {
      const density = Math.min(80, Math.floor(window.innerWidth / 22));
      drops.length = 0;
      for (let index = 0; index < density; index += 1) {
        drops.push(createDrop(width, height));
      }
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      buildDrops();
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      context.lineWidth = 1;

      for (const drop of drops) {
        context.strokeStyle = `rgba(220, 226, 235, ${drop.alpha})`;
        context.beginPath();
        context.moveTo(drop.x, drop.y);
        context.lineTo(drop.x - drop.wind, drop.y + drop.length);
        context.stroke();

        drop.y += drop.speed;
        drop.x -= drop.wind * 0.22;

        if (drop.y > height + 20 || drop.x < -20) {
          Object.assign(drop, createDrop(width, height, true));
        }
      }

      animationId = window.requestAnimationFrame(draw);
    };

    resize();
    const onResize = debounce(resize, 120);
    window.addEventListener("resize", onResize);

    if (!reducedMotion) {
      draw();
    }

    const onVisibilityChange = () => {
      if (document.hidden && animationId) {
        window.cancelAnimationFrame(animationId);
        animationId = 0;
        return;
      }
      if (!document.hidden && !animationId && !reducedMotion) {
        draw();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (animationId) {
        window.cancelAnimationFrame(animationId);
      }
    };
  }, []);

  return (
    <canvas
      className="rain-layer"
      id="rain-layer"
      ref={canvasRef}
      aria-hidden="true"
    />
  );
}