"use client";

import { useRef, useState } from "react";

const TRIGGER = 44;

/**
 * Swipe sideways on a row (touch or pen) and let go to reply. Mouse users keep the normal Reply button.
 * Spread `bind` on the row, move its content by `dx`, and show a hint while `dx !== 0`.
 */
export function useSwipeReply(onReply?: () => void) {
  const [dx, setDx] = useState(0);
  const state = useRef<{ x: number; y: number; locked: boolean; armed: boolean } | null>(null);

  const bind = {
    onPointerDown(event: React.PointerEvent<HTMLElement>) {
      if (!onReply || event.pointerType === "mouse") return;
      if ((event.target as HTMLElement).closest("audio,video,button,a,input,textarea")) return;
      state.current = { x: event.clientX, y: event.clientY, locked: false, armed: false };
    },
    onPointerMove(event: React.PointerEvent<HTMLElement>) {
      const current = state.current;
      if (!current) return;
      const moveX = event.clientX - current.x;
      const moveY = event.clientY - current.y;
      if (!current.locked) {
        if (Math.abs(moveY) > 10 && Math.abs(moveY) > Math.abs(moveX)) {
          state.current = null;
          return;
        }
        if (Math.abs(moveX) < 10) return;
        current.locked = true;
      }
      setDx(Math.max(-64, Math.min(64, moveX * 0.6)));
      const armed = Math.abs(moveX) * 0.6 >= TRIGGER;
      if (armed && !current.armed) navigator.vibrate?.(12);
      current.armed = armed;
    },
    onPointerUp() {
      const current = state.current;
      state.current = null;
      setDx(0);
      if (current?.armed) onReply?.();
    },
    onPointerCancel() {
      state.current = null;
      setDx(0);
    },
  };

  return { dx, bind, progress: Math.min(Math.abs(dx) / TRIGGER, 1) };
}
