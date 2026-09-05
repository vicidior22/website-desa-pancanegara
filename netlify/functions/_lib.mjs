import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

const DATA_STORE = "desa-pancanegara-data";
const MEDIA_STORE = "desa-pancanegara-media";

export const getDataStore = () => getStore(DATA_STORE);
export const getMediaStore = () => getStore(MEDIA_STORE);

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });

export const bad = (error, status = 400) =>
  json({ ok: false, error }, status);

export async function parseBody(request) {
  const type = request.headers.get("content-type") || "";

  if (type.includes("application/json")) {
    return request.json();
  }

  const text = await request.text();

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/**
 * Membaca JSON dari Netlify Blobs.
 *
 * consistency: "strong" digunakan supaya data yang baru
 * disimpan dapat langsung terbaca oleh API.
 */
export async function getJson(store, key, fallback = null) {
  const value = await store.get(key, {
    type: "json",
    consistency: "strong"
  });

  return value ?? fallback;
}

export async function setJson(store, key, value) {
  await store.setJSON(key, value);
}

export function randomId(prefix = "id") {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function timingEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));

  return (
    aa.length === bb.length &&
    crypto.timingSafeEqual(aa, bb)
  );
}

export async function verifyPassword(password, stored) {
  if (!stored) return false;

  const parts = String(stored).split("$");

  if (parts.length !== 6) return false;

  const [algo, N, r, p, salt, hex] = parts;

  if (algo !== "scrypt") return false;
  if (!N || !r || !p || !salt || !hex) return false;

  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(
      String(password),
      salt,
      64,
      {
        N: Number(N),
        r: Number(r),
        p: Number(p)
      },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      }
    );
  });

  return timingEqual(
    Buffer.from(derived).toString("hex"),
    hex
  );
}

export function createSession(username) {
  const payload = `${username}|${Date.now()}`;

  const encoded = Buffer
    .from(payload)
    .toString("base64url");

  const sig = crypto
    .createHmac(
      "sha256",
      process.env.SESSION_SECRET || ""
    )
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${sig}`;
}

export function getSession(request) {
  const cookie = request.headers.get("cookie") || "";

  const match = cookie.match(
    /(?:^|;\s*)desa_session=([^;]+)/
  );

  if (!match) return null;

  const token = decodeURIComponent(match[1]);

  const [encoded, sig] = token.split(".");

  if (
    !encoded ||
    !sig ||
    !process.env.SESSION_SECRET
  ) {
    return null;
  }

  const expected = crypto
    .createHmac(
      "sha256",
      process.env.SESSION_SECRET
    )
    .update(encoded)
    .digest("base64url");

  if (!timingEqual(sig, expected)) {
    return null;
  }

  let payload = "";

  try {
    payload = Buffer
      .from(encoded, "base64url")
      .toString("utf8");
  } catch {
    return null;
  }

  const [username, issued] = payload.split("|");

  if (!username || !issued) {
    return null;
  }

  const issuedTime = Number(issued);

  if (!Number.isFinite(issuedTime)) {
    return null;
  }

  if (
    Date.now() - issuedTime >
    1000 * 60 * 60 * 12
  ) {
    return null;
  }

  return {
    u: username
  };
}

export function requireAdmin(request) {
  if (
    !process.env.ADMIN_USERNAME ||
    !process.env.ADMIN_PASSWORD_HASH ||
    !process.env.SESSION_SECRET
  ) {
    return {
      ok: false,
      response: bad(
        "Konfigurasi admin belum lengkap di Netlify.",
        500
      )
    };
  }

  const session = getSession(request);

  if (!session) {
    return {
      ok: false,
      response: bad(
        "Sesi admin tidak valid atau sudah berakhir.",
        401
      )
    };
  }

  return {
    ok: true,
    user: session
  };
}

export const sessionCookie = token =>
  `desa_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`;

export const clearSessionCookie =
  "desa_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

export async function listRecords(prefix) {
  const store = getDataStore();

  const { blobs } = await store.list({
    prefix
  });

  const rows = await Promise.all(
    blobs.map(({ key }) =>
      getJson(store, key, null)
    )
  );

  return rows.filter(Boolean);
}

export function sortNewest(rows) {
  return rows.sort((a, b) =>
    String(
      b.updatedAt ||
      b.createdAt ||
      ""
    ).localeCompare(
      String(
        a.updatedAt ||
        a.createdAt ||
        ""
      )
    )
  );
}

export async function saveRecord(prefix, id, value) {
  await setJson(
    getDataStore(),
    `${prefix}${id}`,
    value
  );
}

export async function getRecord(prefix, id) {
  return getJson(
    getDataStore(),
    `${prefix}${id}`,
    null
  );
}

export async function deleteRecord(prefix, id) {
  await getDataStore().delete(
    `${prefix}${id}`
  );
}

export async function getSettings() {
  const store = getDataStore();

  const existing = await getJson(
    store,
    "site/settings",
    null
  );

  return existing || {
    siteName: "Desa Pancanegara",

    tagline:
      "Mewujudkan Desa Maju, Mandiri dan Sejahtera Bersama Masyarakat",

    kecamatan: "Tulang Bawang Tengah",

    kabupaten: "Tulang Bawang Barat",

    provinsi: "Lampung",

    phone: "(0726) 123456",

    whatsapp: "6281234567890",

    email: "desa.pancanegara@gmail.com",

    address:
      "Jl. Raya Pancanegara No. 01, Tulang Bawang Tengah, Lampung",

    serviceHours:
      "Senin-Jumat, 08.00-15.00",

    mapsUrl:
      "https://www.google.com/maps",

    latitude: "-4.4000",

    longitude: "105.1000",

    vision:
      "Terwujudnya masyarakat Desa Pancanegara yang maju, mandiri, sejahtera, dan berdaya saing.",

    mission: [
      "Meningkatkan pelayanan publik yang cepat dan transparan.",
      "Mengembangkan potensi ekonomi desa dan UMKM.",
      "Meningkatkan kualitas infrastruktur dan lingkungan.",
      "Mendorong partisipasi masyarakat dalam pembangunan."
    ],

    population: "2.745 jiwa",

    area: "1.245 Ha",

    hamlets: "5 Dusun",

    potential: "Pertanian & UMKM",

    logoKey: "",

    officePhotoKey: "",

    officePhotoUrl: "",
    backgroundUrl: ""
  };
}

export async function saveSettings(value) {
  await setJson(
    getDataStore(),
    "site/settings",
    value
  );
}

export function sanitize(value) {
  return String(value ?? "").trim();
}


