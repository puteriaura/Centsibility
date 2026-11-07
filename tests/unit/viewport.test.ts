import { expect, it } from "vitest";
import { viewportGeometry } from "../../src/lib/viewport";

it("fits overlays to an open keyboard and accounts for viewport panning", () => {
  expect(viewportGeometry(844, 500, 20)).toEqual({ height: 500, top: 20, inset: 324 });
  expect(viewportGeometry(844, 844, 0)).toEqual({ height: 844, top: 0, inset: 0 });
  expect(viewportGeometry(844, 850, -2)).toEqual({ height: 850, top: 0, inset: 0 });
});

it("ignores the zoomed visual viewport without treating pinch zoom as a keyboard", () => {
  expect(viewportGeometry(844, 422, 25, 2)).toEqual({ height: 844, top: 0, inset: 0 });
  expect(viewportGeometry(844, 600, 10, 0.8)).toEqual({ height: 844, top: 0, inset: 0 });
});
