export function sniffImage(bytes: Uint8Array): "image/webp" | "image/jpeg" | "image/png" | null {
  if (bytes.length >= 12 &&
      [0x52, 0x49, 0x46, 0x46].every((b, i) => bytes[i] === b) &&
      [0x57, 0x45, 0x42, 0x50].every((b, i) => bytes[i + 8] === b)) return "image/webp";
  if (bytes.length >= 3 && [0xff, 0xd8, 0xff].every((b, i) => bytes[i] === b)) return "image/jpeg";
  if (bytes.length >= 8 &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  return null;
}

export function validateAvatarImage(bytes: Uint8Array) {
  if (bytes.length > 2 * 1024 * 1024) {
    return { error: "Picture must be 2 MB or smaller.", status: 413 } as const;
  }
  const contentType = sniffImage(bytes);
  if (!contentType) return { error: "Upload a JPG, PNG or WebP picture.", status: 400 } as const;
  return { contentType, extension: contentType === "image/jpeg" ? "jpg" : contentType.slice(6) };
}
