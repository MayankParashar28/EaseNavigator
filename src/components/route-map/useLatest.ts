import { useEffect, useRef } from 'react';

// Keeps a ref pointing at the latest value, so effects can call the newest
// callback/props without re-running (and tearing down) every render.

export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
