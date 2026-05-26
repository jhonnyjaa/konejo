import { useEffect, useRef } from "react";
import { onEvent } from "@/lib/tauri";
import type { EventCallback } from "@tauri-apps/api/event";

export function useTauriEvent<T>(
  event: string,
  callback: EventCallback<T>,
  deps: React.DependencyList = []
) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    onEvent<T>(event, (e) => cbRef.current(e)).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}
