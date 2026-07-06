import { useEffect, useRef, type RefObject } from "react";

/**
 * Hold the latest `value` in a ref, synced in an effect after every render.
 *
 * Notify effects read `ref.current` instead of closing over a callback prop, so
 * their dependency arrays stay data-only (`doc`, `selection`, …). A consumer
 * passing an inline closure — new identity every render, the most natural
 * usage — can then never re-trigger the notify: without this, notify → consumer
 * setState → render → new closure identity → effect re-fires → notify → … loops
 * unbounded (#1). Standard uncontrolled-with-notify hygiene.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
