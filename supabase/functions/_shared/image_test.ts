import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sniffImage, validateAvatarImage } from "./image.ts";

Deno.test("sniffImage recognises PNG, JPEG and WebP magic bytes", () => {
  assertEquals(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])), "image/png");
  assertEquals(sniffImage(new Uint8Array([0xff, 0xd8, 0xff])), "image/jpeg");
  assertEquals(sniffImage(new TextEncoder().encode("RIFF1234WEBP")), "image/webp");
});

Deno.test("avatar validation rejects renamed HTML, SVG, empty and truncated files", () => {
  for (const text of ["<html>test</html>", "<svg></svg>", "", "RIFF", "RIFF1234WAVE"]) {
    const bytes = new TextEncoder().encode(text);
    assertEquals(sniffImage(bytes), null);
    assertEquals(validateAvatarImage(bytes), { error: "Upload a JPG, PNG or WebP picture.", status: 400 });
  }
});

Deno.test("avatar validation enforces decoded size, including the exact limit", () => {
  const bytes = new Uint8Array(2 * 1024 * 1024 + 1);
  bytes.set([0xff, 0xd8, 0xff]);
  assertEquals(validateAvatarImage(bytes).status, 413);
  assertEquals(validateAvatarImage(bytes.subarray(0, -1)), { contentType: "image/jpeg", extension: "jpg" });
});
