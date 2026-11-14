import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  base64UrlEncode,
  createVapidJwt,
  encryptWebPushPayload,
  getVapidConfig,
  sendWebPush,
} from "./web-push.ts";

Deno.test("getVapidConfig returns null when secrets are absent", () => {
  assertEquals(getVapidConfig(), null);
});

Deno.test("createVapidJwt and encryptWebPushPayload work with ephemeral in-memory P-256 keys", async () => {
  const vapidPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const vapidJwk = await crypto.subtle.exportKey("jwk", vapidPair.privateKey);
  const vapidRawPub = new Uint8Array(await crypto.subtle.exportKey("raw", vapidPair.publicKey));
  const vapidPubB64 = base64UrlEncode(vapidRawPub);
  const vapidPrivB64 = vapidJwk.d!;

  const uaPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const uaRawPub = new Uint8Array(await crypto.subtle.exportKey("raw", uaPair.publicKey));
  const uaPubB64 = base64UrlEncode(uaRawPub);
  const authSecret = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));

  const jwt = await createVapidJwt("https://push.example", "mailto:support@centsibility.app", vapidPubB64, vapidPrivB64);
  assertEquals(jwt.split(".").length, 3);

  const encrypted = await encryptWebPushPayload(JSON.stringify({ title: "Test", body: "Hello" }), uaPubB64, authSecret);
  // Header is 16 (salt) + 4 (rs) + 1 (65) + 65 (keyid) = 86 bytes, plus ciphertext + 16-byte GCM tag
  assert(encrypted.length > 86 + 16);
  assertEquals(encrypted[20], 65);

  let capturedAuth = "";
  let capturedEncoding = "";
  const res = await sendWebPush(
    { endpoint: "https://push.example/sub/1", p256dh: uaPubB64, auth: authSecret },
    { title: "Request", body: "RM5.00" },
    { publicKey: vapidPubB64, privateKey: vapidPrivB64, subject: "mailto:support@centsibility.app" },
    async (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      capturedAuth = headers.Authorization;
      capturedEncoding = headers["Content-Encoding"];
      return new Response(null, { status: 201 });
    },
  );
  assertEquals(res.ok, true);
  assertEquals(res.gone, false);
  assertEquals(capturedEncoding, "aes128gcm");
  assert(capturedAuth.startsWith("vapid t="));
});
