import { useEffect, useRef } from "react";
import { onEvent } from "@/lib/tauri";
import type { EventCallback } from "@tauri-apps/api/event";

/**
 * Hook para suscribirse a eventos Tauri con limpieza automática.
 * Compatible con mock mode.
 */
export function useTauriEvent<T>(
  event: string,
  callback: EventCallback<T>,
  deps: React.DependencyList = []
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    onEvent<T>(event, (e) => callbackRef.current(e)).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}
