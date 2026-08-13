"use client";

import { useEffect, useState } from "react";

type TypewriterProps = {
  texts: string[];
  speed?: number;
  deleteSpeed?: number;
  holdMs?: number;
};

type Phase = "typing" | "holding" | "deleting" | "waiting";

export function Typewriter({
  texts,
  speed = 90,
  deleteSpeed = 26,
  holdMs = 2000,
}: TypewriterProps) {
  const [textIndex, setTextIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");

  const full = texts.length ? texts[textIndex % texts.length] : "";

  useEffect(() => {
    if (!texts.length) return;

    if (phase === "typing") {
      if (count >= full.length) {
        const timer = setTimeout(() => setPhase("holding"), 150);
        return () => clearTimeout(timer);
      }
      const timer = setTimeout(() => setCount((c) => c + 1), speed);
      return () => clearTimeout(timer);
    }

    if (phase === "holding") {
      const timer = setTimeout(() => setPhase("deleting"), holdMs);
      return () => clearTimeout(timer);
    }

    if (phase === "deleting") {
      if (count <= 0) {
        const timer = setTimeout(() => setPhase("waiting"), 250);
        return () => clearTimeout(timer);
      }
      const timer = setTimeout(() => setCount((c) => c - 1), deleteSpeed);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setTextIndex((i) => (i + 1) % texts.length);
      setPhase("typing");
    }, 400);
    return () => clearTimeout(timer);
  }, [phase, count, full, texts, speed, deleteSpeed, holdMs]);

  return (
    <h1 className="typewriter-hero">
      {full.slice(0, count)}
      <span className="typewriter-caret" aria-hidden="true">
        _
      </span>
    </h1>
  );
}