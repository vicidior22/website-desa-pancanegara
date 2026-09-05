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

/* =====================================================
   NETLIFY BLOBS - JSON
===================================================== */

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

/* =====================================================
   ID
===================================================== */

export function randomId(prefix = "id") {
  return `${prefix}_${crypto.randomUUID()}`;
}

/* =====================================================
   SLUG
===================================================== */

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/* =====================================================
   PASSWORD
===================================================== */

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

/* =====================================================
   SESSION
===================================================== */

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

/* =====================================================
   RECORDS
===================================================== */

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

/* =====================================================
   SITE SETTINGS
   DESA PANCANEGARA
   KECAMATAN PABUARAN
   KABUPATEN SERANG
   PROVINSI BANTEN
===================================================== */

export async function getSettings() {
  const store = getDataStore();

  const existing = await getJson(
    store,
    "site/settings",
    null
  );

  /*
   * Jika data site sudah tersimpan di Netlify Blobs,
   * gunakan data tersebut.
   *
   * Jika belum ada, gunakan data default
   * Desa Pancanegara Kabupaten Serang Banten.
   */

  return existing || {
    siteName: "Desa Pancanegara",

    tagline:
      "Mewujudkan Desa Maju, Mandiri dan Sejahtera Bersama Masyarakat",

    kecamatan: "Pabuaran",

    kabupaten: "Serang",

    provinsi: "Banten",

    phone: "",

    whatsapp: "",

    email:
      "desa.pancanegara@gmail.com",

    address:
      "Jl. Raya Palka, Pancanegara, Kecamatan Pabuaran, Kabupaten Serang, Banten 42163",

    serviceHours:
      "Senin-Jumat, 08.00-15.00",

    mapsUrl:
      "https://www.google.com/maps",

    latitude: "",

    longitude: "",

    vision:
      "Terwujudnya masyarakat Desa Pancanegara yang maju, mandiri, sejahtera, dan berdaya saing.",

    mission: [
      "Meningkatkan pelayanan publik yang cepat dan transparan.",
      "Mengembangkan potensi ekonomi desa dan UMKM.",
      "Meningkatkan kualitas infrastruktur dan lingkungan.",
      "Mendorong partisipasi masyarakat dalam pembangunan."
    ],

    population:
      "5.647 jiwa",

    area:
      "545 Ha (5,45 km²)",

    hamlets:
      "5 Dusun",

    potential:
      "Pertanian & UMKM",

    /*
     * Jangan menghapus logo dan foto.
     * Nilai ini dapat diisi melalui Admin.
     */

    logoKey: "",

    officePhotoKey: "",

    officePhotoUrl: "",

    backgroundUrl: ""
  };
}

/* =====================================================
   SAVE SITE SETTINGS
===================================================== */

export async function saveSettings(value) {
  /*
   * Ambil data lama terlebih dahulu agar data yang tidak
   * dikirim oleh Admin tidak hilang.
   */

  const store = getDataStore();

  const current = await getJson(
    store,
    "site/settings",
    {}
  );

  const incoming =
    value && typeof value === "object"
      ? value
      : {};

  /*
   * Gabungkan data lama dan data baru.
   * Dengan cara ini foto kantor/background/logo
   * tidak hilang ketika hanya mengubah lokasi.
   */

  const merged = {
    ...current,
    ...incoming,

    siteName:
      String(
        incoming.siteName ??
        current.siteName ??
        "Desa Pancanegara"
      ).trim(),

    tagline:
      String(
        incoming.tagline ??
        current.tagline ??
        "Mewujudkan Desa Maju, Mandiri dan Sejahtera Bersama Masyarakat"
      ).trim(),

    kecamatan:
      String(
        incoming.kecamatan ??
        current.kecamatan ??
        "Pabuaran"
      ).trim(),

    kabupaten:
      String(
        incoming.kabupaten ??
        current.kabupaten ??
        "Serang"
      ).trim(),

    provinsi:
      String(
        incoming.provinsi ??
        current.provinsi ??
        "Banten"
      ).trim(),

    address:
      String(
        incoming.address ??
        current.address ??
        "Jl. Raya Palka, Pancanegara, Kecamatan Pabuaran, Kabupaten Serang, Banten 42163"
      ).trim(),

    population:
      String(
        incoming.population ??
        current.population ??
        "5.647 jiwa"
      ).trim(),

    area:
      String(
        incoming.area ??
        current.area ??
        "545 Ha (5,45 km²)"
      ).trim(),

    potential:
      String(
        incoming.potential ??
        current.potential ??
        "Pertanian & UMKM"
      ).trim(),

    officePhotoUrl:
      String(
        incoming.officePhotoUrl ??
        current.officePhotoUrl ??
        ""
      ).trim(),

    backgroundUrl:
      String(
        incoming.backgroundUrl ??
        current.backgroundUrl ??
        ""
      ).trim(),

    officePhotoKey:
      String(
        incoming.officePhotoKey ??
        current.officePhotoKey ??
        ""
      ).trim(),

    logoKey:
      String(
        incoming.logoKey ??
        current.logoKey ??
        ""
      ).trim()
  };

  await setJson(
    store,
    "site/settings",
    merged
  );

  return merged;
}

/* =====================================================
   SANITIZE
===================================================== */

export function sanitize(value) {
  return String(value ?? "").trim();
}