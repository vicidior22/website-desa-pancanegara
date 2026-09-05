const $=s=>document.querySelector(s);
const api=async(path,opt={})=>{const r=await fetch(`/api${path}`,{...opt,headers:{"Content-Type":"application/json",...(opt.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Permintaan gagal");return d};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const img=v=>v||"/assets/photo-placeholder.svg";
let state={site:null,news:[],gallery:[],structure:[],contacts:[]};

function result(id,msg){const e=document.getElementById(id);if(e)e.textContent=msg}
function switchTab(tab){document.querySelectorAll(".side[data-tab]").forEach(x=>x.classList.toggle("active",x.dataset.tab===tab));document.querySelectorAll(".tab").forEach(x=>x.classList.add("hidden"));document.getElementById(`tab-${tab}`).classList.remove("hidden");$("#title").textContent={overview:"Dashboard Admin",site:"Profil Desa",news:"Berita",gallery:"Galeri",structure:"Struktur Perangkat Desa",maps:"Maps Desa",contacts:"Pesan Masuk",settings:"Pengaturan"}[tab]||"Admin"}
async function boot(){
 try{const me=await api("/auth/me");if(me.authenticated)showDash(me.user);else $("#login").classList.remove("hidden")}catch(e){result("login-result",e.message)}
}
function showDash(user){$("#login").classList.add("hidden");$("#dash").classList.remove("hidden");$("#user").textContent=user.username;bind();refresh()}
function bind(){
 document.querySelectorAll(".side[data-tab]").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
 $("#logout").onclick=async()=>{await api("/auth/logout",{method:"POST"});location.reload()};
 $("#add-news").onclick=()=>openNews();
 $("#add-gallery").onclick=()=>openGallery();
 $("#add-staff").onclick=()=>openStaff();
 $("#close-modal").onclick=()=>$("#modal").classList.add("hidden");
 document.querySelectorAll("[data-upload]").forEach(b=>b.onclick=()=>uploadImage(b.dataset.upload,b.dataset.target));
 $("#site-form").onsubmit=saveSite;
 $("#maps-form").onsubmit=saveMaps;
}
async function refresh(){
 const [site,news,gallery,structure,contacts]=await Promise.all([api("/admin/site"),api("/admin/news"),api("/admin/gallery"),api("/admin/structure"),api("/contacts")]);
 state={site:site.data,news:news.data,gallery:gallery.data,structure:structure.data,contacts:contacts.data};
 fillSite();fillMaps();renderAll();
}
function fillSite(){const f=$("#site-form");Object.entries(state.site||{}).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=Array.isArray(v)?v.join("\n"):v??""});$("#office-preview").src=img(state.site.officePhotoUrl);$("#background-preview").src=img(state.site.backgroundUrl);}
function fillMaps(){const f=$("#maps-form");["mapsUrl","latitude","longitude","address"].forEach(k=>{if(f.elements[k])f.elements[k].value=state.site[k]||""});$("#admin-map").src=embed(state.site.latitude,state.site.longitude)}
function embed(lat,lng){if(!lat||!lng)return"";return `https://www.openstreetmap.org/export/embed.html?bbox=${Number(lng)-.03}%2C${Number(lat)-.02}%2C${Number(lng)+.03}%2C${Number(lat)+.02}&layer=mapnik&marker=${lat}%2C${lng}`}
function renderAll(){
 $("#stat-cards").innerHTML=[["Berita",state.news.length,"▣"],["Galeri",state.gallery.length,"▧"],["Perangkat Desa",state.structure.length,"♙"],["Pesan Masuk",state.contacts.filter(x=>x.status==="new").length,"✉"]].map(x=>`<div class="stat-admin"><span>${x[2]} ${x[0]}</span><b>${x[1]}</b><small>Lihat Detail →</small></div>`).join("");
 $("#overview-news").innerHTML=state.news.slice(0,5).map(n=>row(n,"news")).join("")||"<div class=empty>Belum ada berita.</div>";
 $("#overview-gallery").innerHTML=state.gallery.slice(0,6).map(g=>`<img src="${img(g.imageUrl)}" alt="${esc(g.title)}">`).join("")||"<div class=empty>Belum ada foto.</div>";
 $("#news-list").innerHTML=state.news.map(n=>row(n,"news")).join("")||"<div class=empty>Belum ada berita.</div>";
 $("#gallery-list").innerHTML=state.gallery.map(g=>row(g,"gallery")).join("")||"<div class=empty>Belum ada foto.</div>";
 $("#staff-table").innerHTML=state.structure.sort((a,b)=>a.order-b.order).map((s,i)=>`<tr><td>${i+1}</td><td><img src="${img(s.photoUrl)}"></td><td><b>${esc(s.name)}</b></td><td>${esc(s.position)}</td><td>${esc(s.field)}</td><td>${s.order}</td><td>${s.status}</td><td><div class=actions><button onclick="openStaff('${s.id}')">Edit</button><button class=danger onclick="delItem('/admin/structure','${s.id}')">Hapus</button></div></td></tr>`).join("");
 $("#contacts-list").innerHTML=state.contacts.map(c=>`<div class=admin-row><div class=grow><strong>${esc(c.name)} · ${esc(c.subject||"Tanpa subjek")}</strong><small>${esc(c.message)} · ${esc(c.email||"")} ${esc(c.phone||"")}</small></div><div class=actions><button class=danger onclick="delItem('/contacts','${c.id}')">Hapus</button></div></div>`).join("")||"<div class=empty>Belum ada pesan.</div>";
}
function row(x,type){const title=x.title||x.name;const image=type==="news"?x.coverUrl:x.imageUrl;return `<div class=admin-row><img src="${img(image)}"><div class=grow><strong>${esc(title)}</strong><small>${esc(type==="news"?x.category:x.description||x.position)} · ${esc(x.status||"active")}</small></div><div class=actions><button onclick="${type==="news"?`openNews('${x.id}')`:`openGallery('${x.id}')`}">Edit</button><button class=danger onclick="delItem('/admin/${type}','${x.id}')">Hapus</button></div></div>`}
async function uploadImage(inputId,targetName){
 const input=document.getElementById(inputId),file=input?.files?.[0];if(!file)return alert("Pilih foto terlebih dahulu.");
 if(file.size>4.5*1024*1024)return alert("Maksimal 4,5 MB.");
 try{
   const r=await fetch("/api/admin/upload",{method:"POST",headers:{"Content-Type":file.type},body:file});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||"Upload gagal");

   const form=input.closest("form");

   if(form?.elements[targetName])
     form.elements[targetName].value=d.url;

   const previewId =
     targetName==="backgroundUrl"
       ? "background-preview"
       : targetName==="officePhotoUrl"
         ? "office-preview"
         : "";

   const preview =
     previewId
       ? document.getElementById(previewId)
       : form?.querySelector(".modal-preview");

   if(preview)
     preview.src=d.url;

   alert("Foto berhasil diupload.");
 }catch(e){
   alert(e.message);
 }
}async function saveSite(e){e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget).entries());b.mission=String(b.mission||"").split("\n").map(x=>x.trim()).filter(Boolean);try{await api("/admin/site",{method:"POST",body:JSON.stringify(b)});result("site-result","Profil berhasil disimpan.");await refresh()}catch(e){result("site-result",e.message)}}
async function saveMaps(e){e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget).entries());try{await api("/admin/site",{method:"POST",body:JSON.stringify({...state.site,...b})});result("maps-result","Lokasi berhasil disimpan.");await refresh()}catch(e){result("maps-result",e.message)}}
window.delItem=async(path,id)=>{if(!confirm("Hapus data ini?"))return;await api(`${path}?id=${encodeURIComponent(id)}`,{method:"DELETE"});await refresh()};

function modal(html){$("#modal-content").innerHTML=html;$("#modal").classList.remove("hidden")}
function openNews(id=""){const n=state.news.find(x=>x.id===id)||{};modal(`<span class=eyebrow>BERITA DESA</span><h2>${id?"Edit Berita":"Tambah Berita"}</h2><form id=modal-news class=modal-form><input type=hidden name=id value="${esc(n.id)}"><label class=full>Judul<input name=title required value="${esc(n.title)}"></label><label>Kategori<input name=category value="${esc(n.category||"Kegiatan")}"></label><label>Status<select name=status><option value=published ${n.status!=="draft"?"selected":""}>Dipublikasikan</option><option value=draft ${n.status==="draft"?"selected":""}>Draft</option></select></label><label class=full>Ringkasan<textarea name=excerpt rows=3>${esc(n.excerpt)}</textarea></label><label class=full>Isi Berita<textarea name=content rows=7>${esc(n.content)}</textarea></label><input type=hidden name=coverUrl value="${esc(n.coverUrl)}"><div class=modal-upload><div><b>Foto Cover</b><small>Upload foto langsung dari komputer.</small><input id=news-photo type=file accept=image/*></div><img class=modal-preview src="${img(n.coverUrl)}"></div><div class=modal-actions><button type=button class=btn btn-outline onclick="$('#modal').classList.add('hidden')">Batal</button><button class=btn btn-primary>Simpan Berita</button></div><div id=modal-result class=form-result></div></form>`);
 $("#news-photo").onchange=async e=>{const file=e.target.files[0];if(!file)return;const r=await fetch("/api/admin/upload",{method:"POST",headers:{"Content-Type":file.type},body:file});const d=await r.json();if(r.ok){$("#modal-news").elements.coverUrl.value=d.url;$("#news-photo").closest(".modal-upload").querySelector("img").src=d.url}else alert(d.error||"Upload gagal")};
 $("#modal-news").onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget).entries());try{await api("/admin/news",{method:"POST",body:JSON.stringify(b)});$("#modal").classList.add("hidden");await refresh()}catch(e){result("modal-result",e.message)}}
}
function openGallery(id=""){const g=state.gallery.find(x=>x.id===id)||{};modal(`<span class=eyebrow>GALERI DESA</span><h2>${id?"Edit Foto":"Tambah Foto Galeri"}</h2><form id=modal-gallery class=modal-form><input type=hidden name=id value="${esc(g.id)}"><label class=full>Judul<input name=title required value="${esc(g.title)}"></label><label class=full>Deskripsi<textarea name=description rows=4>${esc(g.description)}</textarea></label><input type=hidden name=imageUrl value="${esc(g.imageUrl)}"><div class=modal-upload><div><b>Foto Galeri</b><small>Pilih foto dari komputer, tanpa memasukkan key.</small><input id=gallery-photo type=file accept=image/* ${g.imageUrl?"":"required"}></div><img class=modal-preview src="${img(g.imageUrl)}"></div><label>Status<select name=status><option value=published ${g.status!=="draft"?"selected":""}>Dipublikasikan</option><option value=draft ${g.status==="draft"?"selected":""}>Draft</option></select></label><div class=modal-actions><button type=button class=btn btn-outline onclick="$('#modal').classList.add('hidden')">Batal</button><button class=btn btn-primary>Simpan Foto</button></div><div id=modal-result class=form-result></div></form>`);
 $("#gallery-photo").onchange=async e=>{const file=e.target.files[0];if(!file)return;const r=await fetch("/api/admin/upload",{method:"POST",headers:{"Content-Type":file.type},body:file});const d=await r.json();if(r.ok){$("#modal-gallery").elements.imageUrl.value=d.url;$("#gallery-photo").closest(".modal-upload").querySelector("img").src=d.url}else alert(d.error||"Upload gagal")};
 $("#modal-gallery").onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget).entries());try{await api("/admin/gallery",{method:"POST",body:JSON.stringify(b)});$("#modal").classList.add("hidden");await refresh()}catch(e){result("modal-result",e.message)}}
}
function openStaff(id=""){const s=state.structure.find(x=>x.id===id)||{};modal(`<span class=eyebrow>PERANGKAT DESA</span><h2>${id?"Edit Perangkat":"Tambah Perangkat"}</h2><form id=modal-staff class=modal-form><input type=hidden name=id value="${esc(s.id)}"><label>Nama<input name=name required value="${esc(s.name)}"></label><label>Jabatan<input name=position required value="${esc(s.position)}"></label><label>Bidang<input name=field value="${esc(s.field||"Pemerintahan")}"></label><label>Urutan<input type=number name=order value="${s.order||1}"></label><label class=full>Bio<textarea name=bio rows=3>${esc(s.bio)}</textarea></label><input type=hidden name=photoUrl value="${esc(s.photoUrl)}"><div class=modal-upload><div><b>Foto Perangkat</b><input id=staff-photo type=file accept=image/*></div><img class=modal-preview src="${img(s.photoUrl)}"></div><label>Status<select name=status><option value=active ${s.status!=="inactive"?"selected":""}>Aktif</option><option value=inactive ${s.status==="inactive"?"selected":""}>Tidak Aktif</option></select></label><div class=modal-actions><button type=button class=btn btn-outline onclick="$('#modal').classList.add('hidden')">Batal</button><button class=btn btn-primary>Simpan</button></div><div id=modal-result class=form-result></div></form>`);
 $("#staff-photo").onchange=async e=>{const file=e.target.files[0];if(!file)return;const r=await fetch("/api/admin/upload",{method:"POST",headers:{"Content-Type":file.type},body:file});const d=await r.json();if(r.ok){$("#modal-staff").elements.photoUrl.value=d.url;$("#staff-photo").closest(".modal-upload").querySelector("img").src=d.url}else alert(d.error||"Upload gagal")};
 $("#modal-staff").onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget).entries());try{await api("/admin/structure",{method:"POST",body:JSON.stringify(b)});$("#modal").classList.add("hidden");await refresh()}catch(e){result("modal-result",e.message)}}
}
$("#login-form").onsubmit=async e=>{e.preventDefault();try{const b=Object.fromEntries(new FormData(e.currentTarget).entries());const r=await api("/auth/login",{method:"POST",body:JSON.stringify(b)});showDash(r.user)}catch(e){result("login-result",e.message)}};
boot();





