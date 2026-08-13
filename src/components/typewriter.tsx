"use client";

import { useEffect, useState } from "react";

type TypewriterProps = {
  text: string;
  speed?: number;
};

export function Typewriter({ text, speed = 80 }: TypewriterProps) {
  const [count, setCount] = useState(0);
  const done = count >= text.length;

  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => setCount((c) => c + 1), speed);
    return () => clearTimeout(timer);
  }, [count, done, speed]);

  return (
    <h1 className="typewriter-hero">
      {text.slice(0, count)}
      <span
        className={`typewriter-caret${done ? " done" : ""}`}
        aria-hidden="true"
      >
        _
      </span>
    </h1>
  );
}