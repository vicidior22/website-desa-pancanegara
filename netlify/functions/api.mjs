import crypto from "node:crypto";
import {
  bad, clearSessionCookie, createSession, deleteRecord, getDataStore, getJson,
  getMediaStore, getRecord, getSession, getSettings, json, listRecords,
  parseBody, randomId, requireAdmin, saveRecord, saveSettings, sessionCookie,
  slugify, sortNewest, verifyPassword
} from "./_lib.mjs";

const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg","image/png","image/webp","image/svg+xml"]);

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

async function login(request) {
  const body = await parseBody(request);
  const username = String(body?.username || "");
  const password = String(body?.password || "");

  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH || !process.env.SESSION_SECRET) {
    return bad("Konfigurasi admin belum lengkap. Isi ADMIN_USERNAME, ADMIN_PASSWORD_HASH, dan SESSION_SECRET di Netlify.", 500);
  }

  const validUser = safeEqual(username, process.env.ADMIN_USERNAME);
  const validPassword = await verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);
  if (!validUser || !validPassword) return bad("Username atau password salah.", 401);

  const token = createSession(username);
  return json({ ok: true, user: { username } }, 200, { "Set-Cookie": sessionCookie(token) });
}

function publicMedia(key) {
  return key ? `/media?key=${encodeURIComponent(key)}` : "";
}

async function upload(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim();
  const body = await request.arrayBuffer();

  if (!ALLOWED_IMAGE_TYPES.has(contentType)) return bad("Format gambar harus JPG, PNG, WEBP, atau SVG.");
  if (body.byteLength > MAX_UPLOAD_BYTES) return bad("Ukuran gambar maksimal 4,5 MB.", 413);

  const id = randomId("media");
  const key = `uploads/${id}`;
  await getMediaStore().set(key, body, {
    metadata: { contentType, uploadedAt: new Date().toISOString() }
  });

  return json({ ok: true, id, url: publicMedia(key), key }, 201);
}

async function get(path, request) {
  if (path === "/health") return json({ ok: true, service: "Desa Pancanegara API", timestamp: new Date().toISOString() });

  if (path === "/auth/me") {
    const s = getSession(request);
    return json({ ok: true, authenticated: Boolean(s), user: s ? { username: s.u } : null });
  }

  if (path === "/site") return json({ ok: true, data: await getSettings() });

  if (path === "/news") {
    const rows = sortNewest(await listRecords("news/"));
    return json({ ok: true, data: rows.filter(x => x.status !== "draft") });
  }

  if (path === "/gallery") {
    const rows = sortNewest(await listRecords("gallery/"));
    return json({ ok: true, data: rows.filter(x => x.status !== "draft") });
  }

  if (path === "/structure") {
    const rows = sortNewest(await listRecords("structure/"));
    return json({ ok: true, data: rows.filter(x => x.status !== "inactive") });
  }

  if (path === "/maps") {
    const site = await getSettings();
    return json({ ok: true, data: {
      mapsUrl: site.mapsUrl, latitude: site.latitude, longitude: site.longitude,
      address: site.address, siteName: site.siteName
    }});
  }

  if (path === "/contacts") {
    const auth = requireAdmin(request);
    if (!auth.ok) return auth.response;
    return json({ ok: true, data: sortNewest(await listRecords("contacts/")) });
  }

  if (path.startsWith("/admin/")) {
    const auth = requireAdmin(request);
    if (!auth.ok) return auth.response;
  }

  if (path === "/admin/site") return json({ ok: true, data: await getSettings() });
  if (path === "/admin/news") return json({ ok: true, data: sortNewest(await listRecords("news/")) });
  if (path === "/admin/gallery") return json({ ok: true, data: sortNewest(await listRecords("gallery/")) });
  if (path === "/admin/structure") return json({ ok: true, data: sortNewest(await listRecords("structure/")) });

  return bad("Endpoint tidak ditemukan.", 404);
}

async function saveNews(request) {
  const body = await parseBody(request);
  const title = String(body?.title || "").trim();
  if (!title) return bad("Judul berita wajib diisi.");

  const id = body?.id || randomId("news");
  const current = body?.id ? await getRecord("news/", body.id) : null;
  const now = new Date().toISOString();
  const record = {
    id, title, slug: slugify(body?.slug || title),
    excerpt: String(body?.excerpt || "").trim(),
    content: String(body?.content || "").trim(),
    category: String(body?.category || "Berita Desa").trim(),
    coverUrl: String(body?.coverUrl || current?.coverUrl || "").trim(),
    status: body?.status === "draft" ? "draft" : "published",
    publishedAt: body?.publishedAt || current?.publishedAt || now,
    createdAt: current?.createdAt || now, updatedAt: now
  };
  await saveRecord("news/", id, record);
  return json({ ok: true, data: record }, 201);
}

async function saveGallery(request) {
  const body = await parseBody(request);
  const title = String(body?.title || "").trim();
  if (!title) return bad("Judul galeri wajib diisi.");
  if (!body?.imageUrl && !body?.id) return bad("Silakan upload foto galeri terlebih dahulu.");

  const id = body?.id || randomId("gallery");
  const current = body?.id ? await getRecord("gallery/", body.id) : null;
  const now = new Date().toISOString();
  const record = {
    id, title,
    description: String(body?.description || "").trim(),
    imageUrl: String(body?.imageUrl || current?.imageUrl || "").trim(),
    status: body?.status === "draft" ? "draft" : "published",
    createdAt: current?.createdAt || now, updatedAt: now
  };
  await saveRecord("gallery/", id, record);
  return json({ ok: true, data: record }, 201);
}

async function saveStructure(request) {
  const body = await parseBody(request);
  const name = String(body?.name || "").trim();
  const position = String(body?.position || "").trim();
  if (!name || !position) return bad("Nama dan jabatan wajib diisi.");

  const id = body?.id || randomId("staff");
  const current = body?.id ? await getRecord("structure/", body.id) : null;
  const now = new Date().toISOString();
  const record = {
    id, name, position,
    field: String(body?.field || "Pemerintahan").trim(),
    order: Number(body?.order || current?.order || 99),
    photoUrl: String(body?.photoUrl || current?.photoUrl || "").trim(),
    bio: String(body?.bio || "").trim(),
    status: body?.status === "inactive" ? "inactive" : "active",
    createdAt: current?.createdAt || now, updatedAt: now
  };
  await saveRecord("structure/", id, record);
  return json({ ok: true, data: record }, 201);
}

async function post(path, request) {
  if (path === "/auth/login") return login(request);
  if (path === "/auth/logout") return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });

  if (path === "/contacts") {
    const body = await parseBody(request);
    const name = String(body?.name || "").trim();
    const message = String(body?.message || "").trim();
    if (!name || !message) return bad("Nama dan pesan wajib diisi.");
    if (message.length > 5000) return bad("Pesan terlalu panjang.");
    const id = randomId("contact");
    await saveRecord("contacts/", id, {
      id, name,
      email: String(body?.email || "").trim(),
      phone: String(body?.phone || "").trim(),
      subject: String(body?.subject || "").trim(),
      message, status: "new", createdAt: new Date().toISOString()
    });
    return json({ ok: true, message: "Pesan berhasil dikirim." }, 201);
  }

  if (path === "/admin/upload") return upload(request);

  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (path === "/admin/site") {
    const body = await parseBody(request);
    await saveSettings(body || {});
    return json({ ok: true, data: await getSettings() });
  }
  if (path === "/admin/news") return saveNews(request);
  if (path === "/admin/gallery") return saveGallery(request);
  if (path === "/admin/structure") return saveStructure(request);

  return bad("Endpoint tidak ditemukan.", 404);
}

async function del(path, request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id || !/^[\w-]+$/.test(id)) return bad("ID tidak valid.");

  const prefix =
    path === "/admin/news" ? "news/" :
    path === "/admin/gallery" ? "gallery/" :
    path === "/admin/structure" ? "structure/" :
    path === "/contacts" ? "contacts/" : null;

  if (!prefix) return bad("Endpoint tidak ditemukan.", 404);
  await deleteRecord(prefix, id);
  return json({ ok: true });
}

export default async (request) => {
  try {
    const path = new URL(request.url).pathname.replace(/^\/api/, "") || "/";
    if (request.method === "GET") return get(path, request);
    if (request.method === "POST") return post(path, request);
    if (request.method === "DELETE") return del(path, request);
    return bad("Method tidak didukung.", 405);
  } catch (error) {
    console.error(error);
    return bad("Terjadi kesalahan pada server.", 500);
  }
};
