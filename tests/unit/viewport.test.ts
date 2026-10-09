import { expect, it } from "vitest";
import { viewportGeometry } from "../../src/lib/viewport";

it("fits overlays to an open keyboard and accounts for viewport panning", () => {
  expect(viewportGeometry(844, 500, 20)).toEqual({ height: 500, top: 20, inset: 324 });
  expect(viewportGeometry(844, 844, 0)).toEqual({ height: 844, top: 0, inset: 0 });
  expect(viewportGeometry(844, 850, -2)).toEqual({ height: 850, top: 0, inset: 0 });
});
