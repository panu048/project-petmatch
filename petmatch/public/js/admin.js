const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let user = null;
let petCache = [];
let panel = 'pets';
let toastTimer;

async function api(url, opts = {}) {
  const res = await fetch('/api' + url, {
    credentials: 'same-origin',
    ...opts,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
  return data;
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function toast(s) {
  $('#toast').textContent = s;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3000);
}

function status(s) {
  const map = {
    available: 'กำลังรอบ้าน',
    pending: 'มีผู้สนใจ',
    adopted: 'ได้บ้านแล้ว',
    approved: 'อนุมัติแล้ว',
    rejected: 'ปฏิเสธ',
    completed: 'เสร็จสิ้น'
  };
  return `<span class="status-pill ${esc(s)}">${map[s] || s}</span>`;
}

async function init() {
  try {
    const me = await api('/auth/me');
    user = me.user;

    if (!user) {
      location.href = '/';
      return;
    }

    if (user.role !== 'admin') {
      alert('หน้านี้สำหรับผู้ดูแลระบบเท่านั้น');
      location.href = '/';
      return;
    }

    $('#adminName').textContent = user.name;
    await loadPets();
  } catch (e) {
    $('#panelContent').innerHTML = `<div class="admin-empty">${esc(e.message)}<br>ตรวจสอบว่าเซิร์ฟเวอร์และฐานข้อมูลพร้อมใช้งาน</div>`;
  }
}

async function loadPets() {
  petCache = await api('/admin/pets');
  $('#countAll').textContent = petCache.length;
  $('#countAvailable').textContent = petCache.filter(p => p.status === 'available').length;
  $('#countAdopted').textContent = petCache.filter(p => p.status === 'adopted').length;
  renderPets();
}

function renderPets() {
  panel = 'pets';
  $('#panelTitle').textContent = 'จัดการข้อมูลสัตว์';
  $('#panelSubtitle').textContent = 'เพิ่มข้อมูล แก้ไขรูปภาพ และดูแลโปรไฟล์สัตว์ที่กำลังรอบ้าน';
  $('#addPetBtn').classList.remove('hidden');

  if (!petCache.length) {
    $('#panelContent').innerHTML = '<div class="admin-empty">ยังไม่มีข้อมูลสัตว์ เริ่มต้นด้วยการเพิ่มน้องตัวแรกได้เลย ♡</div>';
    return;
  }

  $('#panelContent').innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>สัตว์</th>
          <th>ประเภท</th>
          <th>พื้นที่</th>
          <th>สถานะ</th>
          <th>จัดการ</th>
        </tr>
      </thead>
      <tbody>
        ${petCache.map(p => `
          <tr>
            <td>
              <div class="table-pet">
                <img src="${esc(p.image || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=120&q=80')}" alt="" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=120&q=80'">
                <span><strong>${esc(p.name)}</strong><small>${esc(p.breed || 'พันธุ์ผสม')}</small></span>
              </div>
            </td>
            <td>${p.type === 'dog' ? 'สุนัข' : 'แมว'}</td>
            <td>${esc(p.area || '—')}</td>
            <td>${status(p.status)}</td>
            <td>
              <div class="table-actions">
                <button class="small-btn" data-edit="${p.id}">แก้ไข</button>
                <button class="small-btn" data-image="${p.id}">เพิ่มรูป</button>
                <button class="small-btn danger" data-delete="${p.id}">ลบ</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function showPanel(which) {
  panel = which;
  $('#addPetBtn').classList.toggle('hidden', which !== 'pets');

  if (which === 'pets') {
    renderPets();
    return;
  }

  if (which === 'users') {
    $('#panelTitle').textContent = 'สมาชิก';
    $('#panelSubtitle').textContent = 'รายชื่อบัญชีผู้ใช้งานในระบบ';
    const rows = await api('/admin/users');

    $('#panelContent').innerHTML = rows.length ? `
      <table class="admin-table">
        <thead>
          <tr>
            <th>ชื่อ</th>
            <th>อีเมล</th>
            <th>สิทธิ์</th>
            <th>สมัครเมื่อ</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(u => `
            <tr>
              <td>${esc(u.name)}</td>
              <td>${esc(u.email)}</td>
              <td>${esc(u.role)}</td>
              <td>${new Date(u.created_at).toLocaleDateString('th-TH')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<div class="admin-empty">ยังไม่มีสมาชิก</div>';
    return;
  }

  $('#panelTitle').textContent = 'คำขอรับเลี้ยง';
  $('#panelSubtitle').textContent = 'ตรวจสอบและอัปเดตสถานะคำขอรับเลี้ยง';
  const rows = await api('/admin/adoptions');

  $('#panelContent').innerHTML = rows.length ? `
    <table class="admin-table">
      <thead>
        <tr>
          <th>ผู้ขอ</th>
          <th>สัตว์</th>
          <th>โทรศัพท์</th>
          <th>สถานะ</th>
          <th>จัดการ</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(a => `
          <tr>
            <td><strong>${esc(a.user_name)}</strong><br><small>${esc(a.email)}</small></td>
            <td>${esc(a.pet_name)}</td>
            <td>${esc(a.phone)}</td>
            <td>${status(a.status)}</td>
            <td>
              <div class="table-actions">
                <button class="small-btn" data-adoption="${a.id}" data-status="approved">อนุมัติ</button>
                <button class="small-btn danger" data-adoption="${a.id}" data-status="rejected">ปฏิเสธ</button>
                <button class="small-btn" data-adoption="${a.id}" data-status="completed">รับเลี้ยงสำเร็จ</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '<div class="admin-empty">ยังไม่มีคำขอรับเลี้ยง</div>';
}

function openEditor(p = null) {
  $('#petForm').reset();
  $('#petId').value = p?.id || '';
  $('#editorTitle').textContent = p ? 'แก้ไขข้อมูลสัตว์' : 'เพิ่มสัตว์ใหม่';

  const keys = {
    petName: 'name',
    petType: 'type',
    petBreed: 'breed',
    petAge: 'age',
    petGender: 'gender',
    petSize: 'size',
    petArea: 'area',
    petAddress: 'address',
    petLat: 'latitude',
    petLng: 'longitude',
    petStatus: 'status',
    petHealth: 'health_status',
    petDescription: 'description'
  };

  for (const [id, key] of Object.entries(keys)) {
    $('#' + id).value = p?.[key] ?? ({ 'petType': 'dog', 'petGender': 'unknown', 'petSize': 'medium', 'petStatus': 'available' }[id] || '');
  }

  $('#petFeatured').checked = !!p?.featured;
  $('#petImages').value = '';
  $('#imagePreview').innerHTML = '';
  $('#petFormError').textContent = '';
  $('#petEditor').classList.remove('hidden');
}

$('#petImages').addEventListener('change', () => {
  $('#imagePreview').innerHTML = '';
  [...$('#petImages').files].forEach(file => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/) || file.size > 5 * 1024 * 1024) {
      toast('รูปต้องเป็น JPEG, PNG หรือ WebP และไม่เกิน 5 MB');
      return;
    }
    const img = document.createElement('img');
    img.alt = 'ตัวอย่างรูปภาพ';
    img.src = URL.createObjectURL(file);
    $('#imagePreview').append(img);
  });
});

$('#petForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = $('#petId').value;
  const body = {
    name: $('#petName').value,
    type: $('#petType').value,
    breed: $('#petBreed').value,
    age: $('#petAge').value,
    gender: $('#petGender').value,
    size: $('#petSize').value,
    area: $('#petArea').value,
    address: $('#petAddress').value,
    latitude: $('#petLat').value || null,
    longitude: $('#petLng').value || null,
    status: $('#petStatus').value,
    health_status: $('#petHealth').value,
    description: $('#petDescription').value,
    featured: $('#petFeatured').checked
  };

  try {
    let result;
    if (id) {
      await api('/admin/pets/' + id, { method: 'PUT', body: JSON.stringify(body) });
      result = { id };
    } else {
      result = await api('/admin/pets', { method: 'POST', body: JSON.stringify(body) });
    }

    const files = $('#petImages').files;
    if (files.length) {
      const form = new FormData();
      [...files].forEach(f => form.append('images', f));
      await api('/admin/pets/' + result.id + '/images', { method: 'POST', body: form });
    }

    $('#petEditor').classList.add('hidden');
    toast('บันทึกข้อมูลเรียบร้อย');
    await loadPets();
  } catch (err) {
    $('#petFormError').textContent = err.message;
  }
});

document.addEventListener('click', async e => {
  if (e.target.closest('[data-close-modal]')) {
    $('#petEditor').classList.add('hidden');
  }

  const edit = e.target.closest('[data-edit]');
  if (edit) {
    const p = petCache.find(x => String(x.id) === edit.dataset.edit);
    openEditor(p);
    return;
  }

  const add = e.target.closest('#addPetBtn');
  if (add) {
    openEditor();
    return;
  }

  const del = e.target.closest('[data-delete]');
  if (del) {
    const p = petCache.find(x => String(x.id) === del.dataset.delete);
    if (confirm(`ต้องการลบข้อมูล ${p?.name || 'สัตว์ตัวนี้'} ใช่หรือไม่?`)) {
      try {
        await api('/admin/pets/' + del.dataset.delete, { method: 'DELETE' });
        toast('ลบข้อมูลแล้ว');
        await loadPets();
      } catch (err) {
        toast(err.message);
      }
    }
    return;
  }

  const img = e.target.closest('[data-image]');
  if (img) {
    openEditor(petCache.find(x => String(x.id) === img.dataset.image));
    return;
  }

  const adopt = e.target.closest('[data-adoption]');
  if (adopt) {
    try {
      await api('/admin/adoptions/' + adopt.dataset.adoption, {
        method: 'PATCH',
        body: JSON.stringify({ status: adopt.dataset.status })
      });
      toast('อัปเดตสถานะแล้ว');
      await showPanel('adoptions');
    } catch (err) {
      toast(err.message);
    }
  }
});

$$('[data-panel]').forEach(b => b.addEventListener('click', async () => {
  $$('[data-panel]').forEach(x => x.classList.toggle('selected', x === b));
  try {
    await showPanel(b.dataset.panel);
  } catch (e) {
    toast(e.message);
  }
}));

$('#adminLogout').onclick = async () => {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    location.href = '/';
  }
};

init();