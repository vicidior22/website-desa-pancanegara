const $ = (s) => document.querySelector(s);

const api = async (path, options = {}) => {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(`/api${path}`, {
    ...options,
    headers
  });

  const text = await res.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(
      data?.error ||
      `Permintaan ${path} gagal (${res.status})`
    );
  }

  return data;
};


/* =========================================================
   ESCAPE HTML
========================================================= */

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]
  );


/* =========================================================
   TEXT
========================================================= */

const setText = (id, value) => {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value ?? "";
  }
};


/* =========================================================
   MEDIA URL
========================================================= */

function imageOrPlaceholder(url, label = "Foto") {
  const value = String(url || "").trim();

  if (!value) {
    return "/assets/photo-placeholder.svg";
  }

  /*
   * API sudah mengembalikan:
   *
   * /media?key=uploads%2Fmedia_xxxxx
   *
   * Jadi jangan diubah menjadi URL lain.
   */

  if (
    value.startsWith("/media?") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  /*
   * Jika suatu saat API mengembalikan key mentah:
   *
   * uploads/media_xxxxx
   *
   * ubah menjadi:
   *
   * /media?key=uploads%2Fmedia_xxxxx
   */

  if (
    value.startsWith("uploads/") ||
    value.startsWith("media/")
  ) {
    return `/media?key=${encodeURIComponent(value)}`;
  }

  return value || "/assets/photo-placeholder.svg";
}


/* =========================================================
   IMAGE ERROR HANDLER
========================================================= */

function imageFallback(img) {
  if (!img) return;

  img.onerror = () => {
    if (
      img.src &&
      !img.src.includes("photo-placeholder.svg")
    ) {
      img.onerror = null;
      img.src = "/assets/photo-placeholder.svg";
    }
  };
}


/* =========================================================
   MAP
========================================================= */

function mapEmbed(lat, lng) {
  const latitude = Number(String(lat ?? "").replace("°", "").trim());
  const longitude = Number(String(lng ?? "").replace("°", "").trim());

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return "";
  }

  const bbox = [
    longitude - 0.03,
    latitude - 0.02,
    longitude + 0.03,
    latitude + 0.02
  ]
    .map((value) => Number(value).toFixed(6))
    .join("%2C");

  return (
    "https://www.openstreetmap.org/export/embed.html" +
    `?bbox=${bbox}` +
    "&layer=mapnik" +
    `&marker=${latitude}%2C${longitude}`
  );
}


/* =========================================================
   LOAD SITE / PROFIL
========================================================= */

async function loadSite() {
  try {
    const response = await api("/site");
    const s = response?.data || {};

    console.log("SITE DATA:", s);

    setText("hero-title", s.siteName);
    setText("hero-tagline", s.tagline);

    setText("profile-name", s.siteName);
    setText("profile-tagline", s.tagline);
    setText("profile-address", s.address);

    setText("vision", s.vision);

    setText("map-address", s.address);

    setText("footer-address", s.address);
    setText("footer-phone", s.phone);
    setText("footer-email", s.email);

    setText("contact-address", s.address);
    setText("contact-phone", s.phone);
    setText("contact-email", s.email);

    /*
     * Footer location
     */
    const locationParts = [
      s.kecamatan,
      s.kabupaten,
      s.provinsi
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    setText(
      "footer-location",
      locationParts.join(", ")
    );


    /* =====================================================
       STATISTIK
    ===================================================== */

    const stats = [
      [
        "Kependudukan",
        s.population,
        "♙"
      ],
      [
        "Luas Wilayah",
        s.area,
        "⌖"
      ],
      [
        "Jumlah Dusun",
        s.hamlets,
        "▣"
      ],
      [
        "Potensi Desa",
        s.potential,
        "✦"
      ]
    ];


    const statEl = $("#stats");

    if (statEl) {
      statEl.innerHTML = stats
        .map(
          (item) => `
            <div class="stat">
              <i>${esc(item[2])}</i>
              <span>
                ${esc(item[0])}
                <b>${esc(item[1])}</b>
              </span>
            </div>
          `
        )
        .join("");
    }


    const profileStats = $("#profile-stats");

    if (profileStats) {
      profileStats.innerHTML = stats
        .map(
          (item) => `
            <div class="info-card">
              <i>${esc(item[2])}</i>
              <b>${esc(item[1])}</b>
              <small>${esc(item[0])}</small>
            </div>
          `
        )
        .join("");
    }


    /* =====================================================
       FOTO KANTOR DESA
    ===================================================== */

    const office = $("#office-photo");

    if (office) {
      office.src = imageOrPlaceholder(
        s.officePhotoUrl
      );

      office.alt =
        "Foto Kantor Desa Pancanegara";

      imageFallback(office);
    }


    /* =====================================================
       VISI / MISI
    ===================================================== */

    const mission = $("#mission");

    if (mission) {
      const missions = Array.isArray(s.mission)
        ? s.mission
        : [];

      mission.innerHTML = missions
        .map(
          (item) =>
            `<li>${esc(item)}</li>`
        )
        .join("");
    }


    /* =====================================================
       MAPS
    ===================================================== */

    const mapUrl = mapEmbed(
      s.latitude,
      s.longitude
    );

    [
      "map-iframe",
      "profile-map",
      "contact-map",
      "admin-map"
    ].forEach((id) => {
      const element =
        document.getElementById(id);

      if (element && mapUrl) {
        element.src = mapUrl;
      }
    });


    [
      "map-link",
      "profile-map-link"
    ].forEach((id) => {
      const element =
        document.getElementById(id);

      if (element) {
        element.href =
          s.mapsUrl || "#";
      }
    });


    /* =====================================================
       WHATSAPP
    ===================================================== */

    const wa = $("#contact-wa");

    if (wa) {
      const number = String(
        s.whatsapp || ""
      ).replace(/\D/g, "");

      wa.href = number
        ? `https://wa.me/${number}`
        : "#";
    }


    /*
     * Background website global
     * Berbeda dari officePhotoUrl.
     * officePhotoUrl tetap khusus foto kantor Profil.
     */

    const backgroundUrl = s.backgroundUrl || "";
    const backgroundImage = backgroundUrl
      ? `url("${backgroundUrl}")`
      : "none";

    document.documentElement.style.setProperty(
      "--site-background-image",
      backgroundImage
    );

    const heroBg = $("#hero-bg");

    if (heroBg) {
      heroBg.style.backgroundImage =
        backgroundImage;

      heroBg.style.backgroundSize =
        "cover";

      heroBg.style.backgroundPosition =
        "center";
    }

    document.querySelectorAll(".page-hero").forEach((pageHero) => {
      pageHero.style.backgroundImage =
        backgroundImage;

      pageHero.style.backgroundSize =
        "cover";

      pageHero.style.backgroundPosition =
        "center";
      pageHero.style.backgroundRepeat =
        "no-repeat";
    });

  } catch (error) {
    console.error(
      "Gagal memuat data site:",
      error
    );
  }
}


/* =========================================================
   RENDER NEWS
========================================================= */

function renderNews(rows, target) {
  const element =
    document.getElementById(target);

  if (!element) return;

  const data = Array.isArray(rows)
    ? rows
    : [];


  if (!data.length) {
    element.innerHTML =
      '<div class="empty">Belum ada berita.</div>';

    return;
  }


  element.innerHTML = data
    .map((news) => {
      const image =
        imageOrPlaceholder(
          news.coverUrl,
          news.title
        );

      const dateValue =
        news.publishedAt ||
        news.createdAt;

      let dateText = "";

      if (dateValue) {
        const date =
          new Date(dateValue);

        if (!Number.isNaN(
          date.getTime()
        )) {
          dateText =
            date.toLocaleDateString(
              "id-ID",
              {
                day: "2-digit",
                month: "short",
                year: "numeric"
              }
            );
        }
      }


      return `
        <article class="news-card">

          <img
            src="${esc(image)}"
            alt="${esc(news.title)}"
            loading="lazy"
          >

          <div class="news-body">

            <span class="tag">
              ${esc(
                news.category ||
                "Berita Desa"
              )}
            </span>

            <h3>
              ${esc(news.title)}
            </h3>

            <p>
              ${esc(
                news.excerpt ||
                String(
                  news.content || ""
                ).slice(0, 160)
              )}
            </p>

            ${
              dateText
                ? `<small>${esc(dateText)}</small>`
                : ""
            }

          </div>

        </article>
      `;
    })
    .join("");


  element
    .querySelectorAll("img")
    .forEach(imageFallback);
}


/* =========================================================
   RENDER GALLERY
========================================================= */

function renderGallery(rows, target) {
  const element =
    document.getElementById(target);

  if (!element) return;

  const data = Array.isArray(rows)
    ? rows
    : [];


  if (!data.length) {
    element.innerHTML =
      '<div class="empty">Belum ada foto.</div>';

    return;
  }


  element.innerHTML = data
    .map((gallery) => {
      const image =
        imageOrPlaceholder(
          gallery.imageUrl,
          gallery.title
        );

      return `
        <figure class="gallery-card">

          <img
            src="${esc(image)}"
            alt="${esc(
              gallery.title ||
              "Foto Desa"
            )}"
            loading="lazy"
          >

          <figcaption>

            <b>
              ${esc(
                gallery.title ||
                "Dokumentasi Desa"
              )}
            </b>

            ${
              gallery.description
                ? `<small>${esc(
                    gallery.description
                  )}</small>`
                : ""
            }

          </figcaption>

        </figure>
      `;
    })
    .join("");


  element
    .querySelectorAll("img")
    .forEach(imageFallback);
}


/* =========================================================
   LOAD CONTENT
========================================================= */

async function loadContent() {

  /*
   * Jangan menggunakan Promise.all langsung.
   *
   * Jika salah satu endpoint error,
   * berita/galeri/struktur lainnya tetap
   * dicoba dimuat.
   */

  let news = {
    data: []
  };

  let gallery = {
    data: []
  };

  let staff = {
    data: []
  };


  try {
    news = await api("/news");

    console.log(
      "NEWS DATA:",
      news
    );
  } catch (error) {
    console.error(
      "Gagal memuat berita:",
      error
    );
  }


  try {
    gallery = await api("/gallery");

    console.log(
      "GALLERY DATA:",
      gallery
    );
  } catch (error) {
    console.error(
      "Gagal memuat galeri:",
      error
    );
  }


  try {
    staff = await api("/structure");

    console.log(
      "STRUCTURE DATA:",
      staff
    );
  } catch (error) {
    console.error(
      "Gagal memuat struktur:",
      error
    );
  }


  const newsRows =
    Array.isArray(news.data)
      ? news.data
      : [];

  const galleryRows =
    Array.isArray(gallery.data)
      ? gallery.data
      : [];

  const staffRows =
    Array.isArray(staff.data)
      ? staff.data
      : [];


  /* =====================================================
     BERITA
  ===================================================== */

  renderNews(
    newsRows.slice(0, 3),
    "home-news"
  );

  renderNews(
    newsRows,
    "news-list"
  );


  /* =====================================================
     GALERI
  ===================================================== */

  renderGallery(
    galleryRows.slice(0, 5),
    "home-gallery"
  );

  renderGallery(
    galleryRows,
    "gallery-list"
  );


  /* =====================================================
     PERANGKAT DESA
  ===================================================== */

  const staffPreview =
    $("#staff-preview");

  if (staffPreview) {

    staffPreview.innerHTML =
      staffRows
        .slice(0, 4)
        .map((staff) => {

          const image =
            imageOrPlaceholder(
              staff.photoUrl,
              staff.name
            );

          return `
            <div class="staff-mini">

              <img
                src="${esc(image)}"
                alt="${esc(
                  staff.name
                )}"
                loading="lazy"
              >

              <div>

                <b>
                  ${esc(
                    staff.name
                  )}
                </b>

                <small>
                  ${esc(
                    staff.position
                  )}
                </small>

              </div>

            </div>
          `;
        })
        .join("") ||
      '<div class="empty">Belum ada data perangkat desa.</div>';


    staffPreview
      .querySelectorAll("img")
      .forEach(imageFallback);
  }


  /* =====================================================
     STRUKTUR LENGKAP
  ===================================================== */

  const structureList =
    $("#structure-list");

  if (structureList) {

    structureList.innerHTML =
      staffRows
        .map((staff) => {

          const image =
            imageOrPlaceholder(
              staff.photoUrl,
              staff.name
            );

          return `
            <article class="staff-card">

              <img
                src="${esc(image)}"
                alt="${esc(
                  staff.name
                )}"
                loading="lazy"
              >

              <div>

                <span class="tag">
                  ${esc(
                    staff.field ||
                    "Pemerintahan"
                  )}
                </span>

                <h3>
                  ${esc(
                    staff.name
                  )}
                </h3>

                <p>
                  ${esc(
                    staff.position
                  )}
                </p>

                ${
                  staff.bio
                    ? `<small>${esc(
                        staff.bio
                      )}</small>`
                    : ""
                }

              </div>

            </article>
          `;
        })
        .join("") ||
      '<div class="empty">Belum ada data perangkat desa.</div>';


    structureList
      .querySelectorAll("img")
      .forEach(imageFallback);
  }
}


/* =========================================================
   CONTACT FORM
========================================================= */

async function contactForm() {

  const form =
    $("#contact-form");

  if (!form) return;


  form.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      const result =
        $("#contact-result");

      try {

        await api(
          "/contacts",
          {
            method: "POST",
            body: JSON.stringify(
              Object.fromEntries(
                new FormData(form)
                  .entries()
              )
            )
          }
        );


        if (result) {
          result.textContent =
            "Pengaduan berhasil dikirim. Terima kasih.";
        }


        form.reset();

      } catch (error) {

        console.error(
          "Gagal mengirim pengaduan:",
          error
        );

        if (result) {
          result.textContent =
            error.message;
        }
      }
    }
  );
}


/* =========================================================
   MOBILE NAVIGATION
========================================================= */

function mobileNav() {

  const button =
    document.querySelector(
      ".mobile-menu"
    );

  const nav =
    document.querySelector(
      ".nav nav"
    );


  if (!button || !nav) {
    return;
  }


  button.addEventListener(
    "click",
    () => {
      nav.classList.toggle(
        "open"
      );
    }
  );
}


/* =========================================================
   START APPLICATION
========================================================= */

(async () => {

  console.log(
    "Desa Pancanegara frontend starting..."
  );

  try {

    await loadSite();

    await loadContent();

    await contactForm();

    mobileNav();

    console.log(
      "Desa Pancanegara frontend loaded successfully."
    );

  } catch (error) {

    console.error(
      "Frontend initialization error:",
      error
    );

  }

})();

