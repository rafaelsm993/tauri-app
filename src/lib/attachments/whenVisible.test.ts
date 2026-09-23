import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { whenVisible } from "./whenVisible";

type Entry = { isIntersecting: boolean };
let instances: FakeObserver[] = [];

class FakeObserver {
  observed: Element[] = [];
  disconnected = false;
  constructor(
    public cb: (entries: Entry[]) => void,
    public options?: IntersectionObserverInit,
  ) {
    instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
  fire(isIntersecting: boolean) {
    if (this.disconnected) return;
    this.cb([{ isIntersecting }]);
  }
}

describe("whenVisible", () => {
  beforeEach(() => {
    instances = [];
    vi.stubGlobal("IntersectionObserver", FakeObserver);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("calls back once when the element nears the viewport, then stops observing", () => {
    const cb = vi.fn();
    const el = document.createElement("div");
    whenVisible(cb, { rootMargin: "100px" })(el);

    const io = instances[0];
    expect(io.observed).toEqual([el]);
    expect(io.options?.rootMargin).toBe("100px");

    io.fire(false);
    expect(cb).not.toHaveBeenCalled();

    io.fire(true);
    io.fire(true);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(io.disconnected).toBe(true);
  });

  it("disconnects on teardown without calling back", () => {
    const cb = vi.fn();
    const teardown = whenVisible(cb)(document.createElement("div"));
    teardown?.();
    expect(instances[0].disconnected).toBe(true);
    instances[0].fire(true);
    expect(cb).not.toHaveBeenCalled();
  });

  it("calls back immediately when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const cb = vi.fn();
    whenVisible(cb)(document.createElement("div"));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
