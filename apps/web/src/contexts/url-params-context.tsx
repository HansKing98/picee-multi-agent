"use client";

import { useEffect, useState } from "react";

/** Reads `?chat=open` or `?chatOpen=1` / `true` for sidebar default open. */
export function useURLParams() {
  const [chatDefaultOpen, setChatDefaultOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const open =
      params.get("chat") === "open" ||
      params.get("chatOpen") === "1" ||
      params.get("chatOpen") === "true";
    setChatDefaultOpen(open);
  }, []);

  return { chatDefaultOpen };
}
