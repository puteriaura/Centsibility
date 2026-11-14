// RFC 8291 (aes128gcm) + RFC 8292 (VAPID ES256) Web Push sender using WebCrypto.
// Gracefully no-ops when VAPID_* secrets are not configured.

export interface PushSubscriptionRow {
  id?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function getVapidConfig(): VapidConfig | null {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")?.trim() ?? "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")?.trim() ?? "";
  const subject = Deno.env.get("VAPID_SUBJECT")?.trim() ?? "";
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(str: string): Uint8Array {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

async function hkdfExtractAndExpand(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

export async function createVapidJwt(
  audience: string,
  subject: string,
  publicKeyB64: string,
  privateKeyB64: string,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<string> {
  const pubBytes = base64UrlDecode(publicKeyB64);
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error("Invalid VAPID public key");
  }
  const x = base64UrlEncode(pubBytes.slice(1, 33));
  const y = base64UrlEncode(pubBytes.slice(33, 65));
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x,
    y,
    d: privateKeyB64,
    ext: true,
  };
  const signingKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const enc = new TextEncoder();
  const header = base64UrlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = base64UrlEncode(
    enc.encode(JSON.stringify({ aud: audience, exp: nowSec + 12 * 3600, sub: subject })),
  );
  const unsigned = `${header}.${claims}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signingKey, enc.encode(unsigned)),
  );
  return `${unsigned}.${base64UrlEncode(sig)}`;
}

export async function encryptWebPushPayload(
  payloadText: string,
  userPublicKeyB64: string,
  authSecretB64: string,
): Promise<Uint8Array> {
  const uaPublic = base64UrlDecode(userPublicKeyB64);
  const authSecret = base64UrlDecode(authSecretB64);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) {
    throw new Error("Invalid subscription p256dh key");
  }

  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
  const asKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeyPair.publicKey));
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeyPair.privateKey, 256),
  );

  const enc = new TextEncoder();
  const keyInfo = concatBytes(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdfExtractAndExpand(authSecret, sharedSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdfExtractAndExpand(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExtractAndExpand(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const plaintext = concatBytes(enc.encode(payloadText), new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext),
  );

  // aes128gcm header: salt (16) || rs (4, uint32be=4096) || idlen (1, 65) || keyid (65)
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = asPublic.length;
  header.set(asPublic, 21);

  return concatBytes(header, ciphertext);
}

export async function sendWebPush(
  sub: PushSubscriptionRow,
  payload: PushPayload,
  vapid: VapidConfig,
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; gone: boolean }> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await createVapidJwt(audience, vapid.subject, vapid.publicKey, vapid.privateKey);
  const body = await encryptWebPushPayload(JSON.stringify(payload), sub.p256dh, sub.auth);

  const res = await fetchFn(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
    },
    body,
  });

  return {
    ok: res.ok,
    status: res.status,
    gone: res.status === 404 || res.status === 410,
  };
}

export async function sendPushToSubscriptions(
  // deno-lint-ignore no-explicit-any
  admin: any,
  filter: { parentId?: string; kidId?: string },
  payload: PushPayload,
): Promise<{ sent: number; removed: number; skipped: boolean }> {
  const vapid = getVapidConfig();
  if (!vapid) return { sent: 0, removed: 0, skipped: true };

  try {
    let query = admin.from("push_subscriptions").select("id, endpoint, p256dh, auth");
    if (filter.parentId) query = query.eq("parent_id", filter.parentId).eq("role", "parent");
    else if (filter.kidId) query = query.eq("kid_id", filter.kidId).eq("role", "kid");
    else return { sent: 0, removed: 0, skipped: true };

    const { data: subs } = await query;
    if (!subs || subs.length === 0) return { sent: 0, removed: 0, skipped: false };

    let sent = 0;
    const goneIds: string[] = [];
    for (const sub of subs) {
      try {
        const res = await sendWebPush(sub, payload, vapid);
        if (res.ok) sent++;
        else if (res.gone && sub.id) goneIds.push(sub.id);
      } catch {
        // Never fail caller when a push endpoint errors
      }
    }

    if (goneIds.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", goneIds);
    }

    return { sent, removed: goneIds.length, skipped: false };
  } catch {
    return { sent: 0, removed: 0, skipped: false };
  }
}
