import { getMediaStore } from "./_lib.mjs";

export default async (request) => {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (
      !key ||
      key.startsWith("/") ||
      key.length > 600
    ) {
      return new Response("Media tidak ditemukan.", {
        status: 404,
      });
    }

    const store = getMediaStore();

    const result = await store.getWithMetadata(key, {
      type: "arrayBuffer",
      consistency: "strong",
    });

    if (!result || !result.data) {
      return new Response("Media tidak ditemukan.", {
        status: 404,
      });
    }

    const contentType =
      result.metadata?.contentType ||
      "application/octet-stream";

    return new Response(result.data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control":
          "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Media error:", error);

    return new Response("Gagal mengambil media.", {
      status: 500,
    });
  }
};