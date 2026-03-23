"use client";

import { useCallback, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

export function useMobileChat(defaultHeightPercent: number) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatHeight, setChatHeight] = useState(defaultHeightPercent);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const startY = e.clientY;
      const startHeight = chatHeight;

      const onMove = (ev: MouseEvent) => {
        const deltaY = startY - ev.clientY;
        const vhDelta = (deltaY / window.innerHeight) * 100;
        const next = Math.min(90, Math.max(30, startHeight + vhDelta));
        setChatHeight(next);
      };

      const onUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [chatHeight]
  );

  return {
    isChatOpen,
    setChatHeight,
    setIsChatOpen,
    isDragging,
    chatHeight,
    handleDragStart,
  };
}
