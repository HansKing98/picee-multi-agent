"use client";

import { useEffect, useState } from "react";

const MOBILE_MAX_PX = 768;

export function useMobileView() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_PX - 1}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return { isMobile };
}
