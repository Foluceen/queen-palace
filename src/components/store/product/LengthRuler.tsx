"use client";

import { useEffect, useRef } from "react";
import { animate, interrupt } from "@/lib/motion/anime";

const MIN = 6;
const MAX = 30;

/** Where a length typically falls on the body, measured straight. */
export function fallsTo(inches: number): string {
  if (inches <= 8) return "sits around the ears and nape";
  if (inches <= 10) return "falls to the chin";
  if (inches <= 12) return "falls to the jawline and neck";
  if (inches <= 14) return "rests on the shoulders";
  if (inches <= 18) return "falls just below the shoulders";
  if (inches <= 22) return "reaches mid-back";
  if (inches <= 26) return "reaches the waist";
  return "falls to the hips";
}

const landmarks = [
  { at: 10, label: "Chin" },
  { at: 14, label: "Shoulder" },
  { at: 20, label: "Mid-back" },
  { at: 24, label: "Waist" },
  { at: 28, label: "Hip" },
];

const pct = (inches: number) => ((Math.min(MAX, Math.max(MIN, inches)) - MIN) / (MAX - MIN)) * 100;
export const inchesOf = (v: string) => parseInt(v, 10);

interface Props {
  values: string[];
  selected: string | undefined;
  isAvailable(value: string): boolean;
  onSelect(value: string): void;
}

/**
 * Length selector drawn as a measuring tape, so customers see where each length lands
 * rather than guessing from a number. A real radio group underneath for keyboard and
 * screen-reader users; the marker glides to the new length with Anime.js.
 */
export function LengthRuler({ values, selected, isAvailable, onSelect }: Props) {
  const markerRef = useRef<HTMLDivElement>(null);
  const prev = useRef<string | undefined>(selected);
  const selectedIn = selected ? inchesOf(selected) : null;

  useEffect(() => {
    const el = markerRef.current;
    if (!el || selectedIn === null) return;
    const from = prev.current ? pct(inchesOf(prev.current)) : pct(selectedIn);
    const to = pct(selectedIn);
    prev.current = selected;
    void interrupt(el);
    el.style.left = `${to}%`;
    if (from !== to) void animate(el, { left: [`${from}%`, `${to}%`], duration: 560, ease: "outExpo" }, "essential");
  }, [selected, selectedIn]);

  const ticks = [];
  for (let i = MIN; i <= MAX; i += 2) ticks.push(i);

  return (
    <fieldset className="ruler">
      <legend className="option__legend">
        Length <span className="option__value">{selected ? `${selected}, ${fallsTo(selectedIn!)}` : "Choose a length"}</span>
      </legend>
      <div className="ruler__tape" aria-hidden>
        {ticks.map((t) => (
          <span key={t} className={`ruler__tick ${t % 4 === 2 ? "ruler__tick--major" : ""}`} style={{ left: `${pct(t)}%` }} />
        ))}
        {landmarks.map((l) => (
          <span key={l.label} className="ruler__landmark" style={{ left: `${pct(l.at)}%` }}>
            {l.label}
          </span>
        ))}
        {selectedIn !== null ? <div ref={markerRef} className="ruler__marker" style={{ left: `${pct(selectedIn)}%` }} /> : null}
      </div>
      <div className="ruler__options" role="radiogroup" aria-label="Length">
        {values.map((v) => {
          const available = isAvailable(v);
          const on = v === selected;
          return (
            <label key={v} className={`ruler__opt ${on ? "is-on" : ""} ${available ? "" : "is-unavailable"}`} style={{ left: `${pct(inchesOf(v))}%` }}>
              <input type="radio" name="length" value={v} checked={on} onChange={() => onSelect(v)} className="sr-only" />
              <span className="ruler__opt-label">{v}</span>
              {!available ? <span className="sr-only"> (sold out in this combination)</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
