const API = '/api';
let currentUser = null;
let pets = [];
let favoritePets = [];
let activeCategory = '';
let map = null;
let mapMarkers = [];
let authMode = 'login';
let toastTimer;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

async function api(url, options = {}) {
  const res = await fetch(API + url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
  return data;
}

function escapeHTML(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function imageOf(p) {
  return p.image || p.images?.[0]?.image_path || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80';
}

function renderPets() {
  const grid = $('#petGrid');
  let list = pets.filter(p => !activeCategory || p.type === activeCategory);

  const q = $('#searchInput').value.trim().toLowerCase();
  if (q) {
    list = list.filter(p => [p.name, p.breed, p.description, p.area].join(' ').toLowerCase().includes(q));
  }

  if ($('#sortFilter').value === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }

  $('#allCount').textContent = pets.length;
  grid.innerHTML = '';
  $('#petEmpty').classList.toggle('hidden', list.length > 0);

  if (!list.length) {
    grid.classList.add('hidden');
    return;
  }

  grid.classList.remove('hidden');
  grid.innerHTML = list.map(p => `
    <article class="pet-card" data-pet="${p.id}" tabindex="0" role="button" aria-label="ดูรายละเอียด ${escapeHTML(p.name)}">
      <div class="pet-image">
        <img loading="lazy" src="${escapeHTML(imageOf(p))}" alt="รูป${escapeHTML(p.name)}" onerror="this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80'">
        <span class="pet-badge">${p.type === 'dog' ? 'น้องหมา' : 'น้องแมว'} · ${p.status === 'pending' ? 'กำลังดำเนินการ' : 'กำลังรอบ้าน'}</span>
        <button class="favorite-btn ${favoritePets.some(f => String(f.id) === String(p.id)) ? 'favorited' : ''}" data-fav="${p.id}" aria-label="บันทึกรายการโปรด">
          ${favoritePets.some(f => String(f.id) === String(p.id)) ? '♥' : '♡'}
        </button>
      </div>
      <div class="pet-info">
        <div class="pet-title-row">
          <h3>${escapeHTML(p.name)}</h3>
          <span class="pet-gender">${p.gender === 'male' ? '♂' : p.gender === 'female' ? '♀' : '•'}</span>
        </div>
        <div class="pet-meta">${escapeHTML(p.breed || 'พันธุ์ผสม')} · ${escapeHTML(p.age || 'ไม่ระบุอายุ')}</div>
        <div class="pet-card-bottom">
          <span class="pet-location">⌖ ${escapeHTML(p.area || 'ไม่ระบุพื้นที่')}</span>
          <span class="pet-view">รู้จักน้อง ↗</span>
        </div>
      </div>
    </article>
  `).join('');
}

async function loadPets() {
  try {
    pets = await api('/pets');
    renderPets();
  } catch (e) {
    $('#petGrid').innerHTML = `<div class="loading-card">${escapeHTML(e.message)}<br><small>ตรวจสอบการเชื่อมต่อฐานข้อมูล แล้วลองรีเฟรชอีกครั้ง</small></div>`;
  }
}

async function loadStats() {
  try {
    const s = await api('/stats');
    $('#statAvailable').textContent = s.available.toLocaleString('th-TH');
    $('#statAdopted').textContent = s.adopted.toLocaleString('th-TH');
    $('#statMembers').textContent = s.members.toLocaleString('th-TH');
    $('#heroAdopted').textContent = `${s.adopted.toLocaleString('th-TH')}+ ชีวิตใหม่`;
  } catch (e) {
    $('#heroAdopted').textContent = 'ทุกชีวิตมีความหมาย';
  }
}

function openAuth(mode) {
  authMode = mode;
  $('#authModal').classList.remove('hidden');
  $('#authTitle').textContent = mode === 'login' ? 'ยินดีต้อนรับกลับ ♡' : 'มาสร้างความทรงจำดี ๆ กัน';
  $('#authSubtitle').textContent = mode === 'login' ? 'เข้าสู่ระบบเพื่อเริ่มต้นเรื่องราวดี ๆ' : 'สมัครสมาชิกเพื่อบันทึกน้องที่ชอบและส่งคำขอรับเลี้ยง';
  $('#nameField').classList.toggle('hidden', mode === 'login');
  $('#authName').required = mode === 'register';
  $('#authPassword').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $('#authSubmit').innerHTML = mode === 'login' ? 'เข้าสู่ระบบ <span>→</span>' : 'สมัครสมาชิก <span>→</span>';
  $('#switchText').textContent = mode === 'login' ? 'ยังไม่มีบัญชี?' : 'มีบัญชีอยู่แล้ว?';
  $('#switchAuth').textContent = mode === 'login' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ';
  $('#authError').textContent = '';
  $('#authForm').reset();
}

function closeModals() {
  $$('.modal-backdrop').forEach(m => m.classList.add('hidden'));
}

function updateHeader() {
  const actions = $('#headerActions');
  if (currentUser) {
    actions.innerHTML = `
      <span class="user-greeting">สวัสดี ${escapeHTML(currentUser.name)}</span>
      ${currentUser.role === 'admin' ? '<a class="btn btn-outline" href="/admin.html">จัดการระบบ</a>' : ''}
      <button class="btn btn-primary" id="logoutBtn">ออกจากระบบ</button>
    `;

    $('#logoutBtn').onclick = async () => {
      try {
        await api('/auth/logout', { method: 'POST' });
        currentUser = null;
        favoritePets = [];
        updateHeader();
        await loadFavorites();
        toast('ออกจากระบบแล้ว');
      } catch (e) {
        toast(e.message);
      }
    };
  } else {
    actions.innerHTML = `
      <button class="btn btn-quiet" data-open-auth="login">เข้าสู่ระบบ</button>
      <button class="btn btn-primary" data-open-auth="register">เริ่มต้นใช้งาน <span>↗</span></button>
    `;
  }
}

async function loadMe() {
  try {
    const r = await api('/auth/me');
    currentUser = r.user;
    updateHeader();
  } catch (e) {}
}

async function showDetail(id) {
  try {
    const p = await api('/pets/' + id);
    $('#detailContent').innerHTML = `
      <div class="detail-layout">
        <img class="detail-photo" src="${escapeHTML(imageOf(p))}" alt="${escapeHTML(p.name)}">
        <div class="detail-copy">
          <div class="eyebrow">MEET YOUR NEW FRIEND</div>
          <h2 id="detailName">${escapeHTML(p.name)} ♡</h2>
          <div class="detail-meta">
            <span>${p.type === 'dog' ? 'น้องหมา' : 'น้องแมว'}</span>
            <span>${escapeHTML(p.breed || 'พันธุ์ผสม')}</span>
            <span>${escapeHTML(p.age || 'ไม่ระบุอายุ')}</span>
          </div>
          <p>${escapeHTML(p.description || 'น้องกำลังรอพบครอบครัวที่อบอุ่นและพร้อมดูแล')}</p>
          <p><strong>สุขภาพ:</strong> ${escapeHTML(p.health_status || 'สอบถามผู้ดูแล')}</p>
          <p><strong>พื้นที่:</strong> ${escapeHTML([p.area, p.address].filter(Boolean).join(' · ') || 'สอบถามผู้ดูแล')}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:20px">
            <button class="btn btn-primary" id="detailAdopt">ขอรับเลี้ยงน้อง <span>♡</span></button>
            <button class="btn btn-outline" id="detailFavorite">${favoritePets.some(f => String(f.id) === String(p.id)) ? '♥' : '♡'} บันทึกไว้</button>
          </div>
        </div>
      </div>
    `;

    $('#detailModal').classList.remove('hidden');

    $('#detailAdopt').onclick = () => {
      if (!currentUser) {
        closeModals();
        openAuth('login');
        toast('เข้าสู่ระบบก่อนส่งคำขอรับเลี้ยง');
        return;
      }
      $('#adoptPetId').value = p.id;
      closeModals();
      $('#adoptModal').classList.remove('hidden');
    };

    $('#detailFavorite').onclick = () => toggleFavorite(p.id);
  } catch (e) {
    toast(e.message);
  }
}

async function loadFavorites() {
  const grid = $('#favoritesGrid');
  if (!currentUser) {
    favoritePets = [];
    grid.innerHTML = '<div class="loading-card">เข้าสู่ระบบเพื่อดูรายการโปรดของคุณ ♡</div>';
    renderPets();
    return;
  }

  try {
    favoritePets = await api('/favorites');
    renderPets();
    renderFavorites();
  } catch (e) {
    grid.innerHTML = `<div class="loading-card">${escapeHTML(e.message)}</div>`;
  }
}

function renderFavorites() {
  const grid = $('#favoritesGrid');
  const empty = $('#favoritesEmpty');
  if (!grid) return;

  if (!currentUser) {
    grid.innerHTML = '<div class="loading-card">เข้าสู่ระบบเพื่อดูรายการโปรดของคุณ ♡</div>';
    empty.classList.add('hidden');
    return;
  }

  if (!favoritePets.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = favoritePets.map(p => `
    <article class="pet-card" data-pet="${p.id}" tabindex="0" role="button" aria-label="ดูรายละเอียด ${escapeHTML(p.name)}">
      <div class="pet-image">
        <img loading="lazy" src="${escapeHTML(imageOf(p))}" alt="รูป${escapeHTML(p.name)}">
        <span class="pet-badge">${p.type === 'dog' ? 'น้องหมา' : 'น้องแมว'}</span>
        <button class="favorite-btn favorited" data-fav="${p.id}" aria-label="นำออกจากรายการโปรด">♥</button>
      </div>
      <div class="pet-info">
        <div class="pet-title-row">
          <h3>${escapeHTML(p.name)}</h3>
        </div>
        <div class="pet-meta">${escapeHTML(p.breed || 'พันธุ์ผสม')} · ${escapeHTML(p.age || 'ไม่ระบุอายุ')}</div>
        <div class="pet-card-bottom">
          <span class="pet-location">⌖ ${escapeHTML(p.area || 'ไม่ระบุพื้นที่')}</span>
          <span class="pet-view">รู้จักน้อง ↗</span>
        </div>
        <button class="btn btn-outline" style="margin-top:12px;width:100%" data-fav="${p.id}">นำออกจากรายการโปรด ✕</button>
      </div>
    </article>
  `).join('');
}

async function toggleFavorite(id) {
  if (!currentUser) {
    openAuth('login');
    toast('เข้าสู่ระบบเพื่อบันทึกรายการโปรด');
    return;
  }

  try {
    const exists = favoritePets.some(p => String(p.id) === String(id));
    if (exists) {
      await api('/favorites/' + id, { method: 'DELETE' });
      toast('นำออกจากรายการโปรดแล้ว');
    } else {
      await api('/favorites/' + id, { method: 'POST' });
      toast('เพิ่มในรายการโปรดแล้ว');
    }

    await loadFavorites();

    if ($('#detailFavorite')) {
      const b = $('#detailFavorite');
      const saved = favoritePets.some(p => String(p.id) === String(id));
      b.innerHTML = saved ? '♥ นำออกจากรายการโปรด' : '♡ เพิ่มในรายการโปรด';
    }
  } catch (e) {
    toast(e.message);
  }
}

function initMap() {
  if (!window.L) {
    $('#mapCount').textContent = 'โหลดแผนที่ไม่สำเร็จ';
    return;
  }

  map = L.map('petMap', { scrollWheelZoom: false }).setView([13.8199, 100.0622], 9);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);

  loadMapPets();
}

async function loadMapPets() {
  try {
    const list = await api('/map/pets');
    mapMarkers.forEach(m => map.removeLayer(m));
    mapMarkers = [];

    list.forEach(p => {
      const color = p.type === 'dog' ? '#e6a078' : '#5e8568';
      const icon = L.divIcon({
        className: 'pet-pin',
        html: `<div style="background:${color};width:30px;height:30px;border:3px solid white;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);box-shadow:0 3px 8px #0003;display:grid;place-items:center"><span style="transform:rotate(45deg);color:white;font-size:13px">${p.type === 'dog' ? '●' : '♥'}</span></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      });

      const marker = L.marker([Number(p.latitude), Number(p.longitude)], { icon }).addTo(map);
      marker.bindPopup(`
        <div class="map-popup">
          <img src="${escapeHTML(imageOf(p))}" alt="">
          <strong>${escapeHTML(p.name)}</strong>
          <span>${p.type === 'dog' ? 'น้องหมา' : 'น้องแมว'} · ${escapeHTML(p.area || '')}</span><br>
          <button onclick="window.petMatchDetail(${Number(p.id)})">ดูรายละเอียดน้อง ↗</button>
        </div>
      `);
      mapMarkers.push(marker);
    });

    $('#mapCount').textContent = `${list.length} ตำแหน่งที่รอบ้าน`;

    if (list.length) {
      const bounds = L.latLngBounds(list.map(p => [Number(p.latitude), Number(p.longitude)]));
      map.fitBounds(bounds.pad(0.18), { maxZoom: 12 });
    }
  } catch (e) {
    $('#mapCount').textContent = 'ไม่สามารถโหลดตำแหน่งได้';
  }
}

window.petMatchDetail = showDetail;

function searchArea() {
  const area = $('#areaSearch').value.trim();
  if (!area) {
    toast('กรุณาพิมพ์ชื่อพื้นที่ก่อน');
    return;
  }

  const match = pets.filter(p => (p.area || '').toLowerCase().includes(area.toLowerCase()));
  if (match.length) {
    $('#searchInput').value = '';
    $('#typeFilter').value = '';
    $('#quickSearch').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    const found = match[0];
    if (found.latitude && found.longitude && map) {
      map.setView([Number(found.latitude), Number(found.longitude)], 13);
    }
    toast(`พบน้อง ${match.length} ตัวในพื้นที่ที่ค้นหา`);
  } else {
    toast('ยังไม่พบข้อมูลน้องในพื้นที่นี้ ลองค้นหาชื่ออำเภอหรือจังหวัดอื่น');
  }
}

$('#quickSearch').addEventListener('submit', e => {
  e.preventDefault();
  const type = $('#typeFilter').value;
  activeCategory = type;
  $$('[data-category]').forEach(b => b.classList.toggle('selected', b.dataset.category === type));
  renderPets();
  $('#pets').scrollIntoView({ behavior: 'smooth' });
});

$$('[data-category]').forEach(b => b.addEventListener('click', () => {
  activeCategory = b.dataset.category;
  $('#typeFilter').value = activeCategory;
  $$('[data-category]').forEach(x => x.classList.toggle('selected', x === b));
  renderPets();
}));

$$('[data-query]').forEach(b => b.addEventListener('click', () => {
  $('#searchInput').value = b.dataset.query;
  renderPets();
}));

$('#sortFilter').addEventListener('change', renderPets);

$('#resetSearch').onclick = () => {
  $('#searchInput').value = '';
  $('#typeFilter').value = '';
  activeCategory = '';
  $$('[data-category]').forEach(x => x.classList.toggle('selected', x.dataset.category === ''));
  renderPets();
};

$('#showAll').onclick = e => {
  e.preventDefault();
  $('#resetSearch').click();
};

$('#searchArea').onclick = searchArea;
$('#areaSearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    searchArea();
  }
});

$('#mobileMenu').onclick = () => $('#mainNav').classList.toggle('open');
$('#mainNav').addEventListener('click', e => {
  if (e.target.closest('a')) $('#mainNav').classList.remove('open');
});

document.addEventListener('click', e => {
  const auth = e.target.closest('[data-open-auth]');
  if (auth) openAuth(auth.dataset.openAuth);

  if (e.target.closest('[data-close-modal]')) closeModals();
  if (e.target.classList.contains('modal-backdrop')) closeModals();

  const fav = e.target.closest('[data-fav]');
  if (fav) {
    e.stopPropagation();
    toggleFavorite(fav.dataset.fav);
    return;
  }

  const card = e.target.closest('[data-pet]');
  if (card) showDetail(card.dataset.pet);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModals();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-pet]')) {
    showDetail(e.target.dataset.pet);
  }
});

$('#switchAuth').onclick = () => openAuth(authMode === 'login' ? 'register' : 'login');

$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = {
    email: $('#authEmail').value,
    password: $('#authPassword').value
  };

  if (authMode === 'register') body.name = $('#authName').value;

  try {
    const r = await api('/auth/' + authMode, { method: 'POST', body: JSON.stringify(body) });
    currentUser = r.user;
    updateHeader();
    await loadFavorites();
    closeModals();
    toast(authMode === 'login' ? 'เข้าสู่ระบบสำเร็จ' : 'สมัครสมาชิกสำเร็จ ยินดีต้อนรับ!');
  } catch (err) {
    $('#authError').textContent = err.message;
  }
});

$('#adoptForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('/adoptions', {
      method: 'POST',
      body: JSON.stringify({
        pet_id: $('#adoptPetId').value,
        phone: $('#adoptPhone').value,
        address: $('#adoptAddress').value,
        message: $('#adoptMessage').value
      })
    });
    closeModals();
    $('#adoptForm').reset();
    toast('ส่งคำขอรับเลี้ยงแล้ว ผู้ดูแลจะติดต่อกลับ');
  } catch (err) {
    $('#adoptError').textContent = err.message;
  }
});

(async () => {
  await loadMe();
  await Promise.all([loadPets(), loadStats()]);
  await loadFavorites();
  initMap();
})();