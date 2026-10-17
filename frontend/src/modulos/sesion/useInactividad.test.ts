import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInactividad } from "./useInactividad";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("cierre por inactividad", () => {
  it("cierra a los 30 minutos sin tocar la pantalla", () => {
    const alVencer = vi.fn();
    renderHook(() => useInactividad(alVencer));
    vi.advanceTimersByTime(29 * 60_000);
    expect(alVencer).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(alVencer).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10 * 60_000);
    expect(alVencer).toHaveBeenCalledOnce(); // una sola vez
  });

  it("tocar la pantalla vuelve a contar desde cero", () => {
    const alVencer = vi.fn();
    renderHook(() => useInactividad(alVencer));
    vi.advanceTimersByTime(20 * 60_000);
    fireEvent.pointerDown(window);
    vi.advanceTimersByTime(20 * 60_000);
    expect(alVencer).not.toHaveBeenCalled();
    vi.advanceTimersByTime(11 * 60_000);
    expect(alVencer).toHaveBeenCalledOnce();
  });

  it("si el iPad estuvo bloqueado más de 30 minutos, cierra en cuanto regresa", () => {
    const alVencer = vi.fn();
    renderHook(() => useInactividad(alVencer));
    // Safari pausa los temporizadores: solo avanza el reloj
    vi.setSystemTime(Date.now() + 45 * 60_000);
    fireEvent.pointerDown(window);
    expect(alVencer).toHaveBeenCalledOnce();
  });
});
