/* ============================================================
   Mishra Property Dealer — Admin dashboard logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');

  async function enterDashboard(){
    loginView.style.display = 'none';
    dashboardView.hidden = false;
    initRipple();
    await refreshAll();
  }

  async function refreshAll(){
    // Run together — each panel renders as soon as its own data arrives.
    await Promise.all([renderStats(), renderInventory(), renderLeads(), renderAnalytics()]);
  }

  if(Store.isAdmin()) enterDashboard();

  document.getElementById('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const pw = document.getElementById('loginPassword').value;
    if(Store.login(pw)){
      enterDashboard();
    }else{
      document.getElementById('loginMessage').textContent = "That password isn't right — try again.";
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    Store.logout();
    location.reload();
  });

  // Photo upload preview
  const photoInput = document.querySelector('input[name="photo"]');
  const photoPreview = document.getElementById('photoPreview');
  let pendingPhoto = '';
  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      pendingPhoto = reader.result;
      photoPreview.style.display = 'block';
      photoPreview.style.backgroundImage = `url('${pendingPhoto}')`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('propertyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const msg = document.getElementById('propertyMessage');
    submitBtn.disabled = true;
    msg.textContent = 'Saving…';
    try{
      await Store.addListing({
        id: genId(),
        title: form.title.value.trim(),
        type: form.type.value,
        status: form.status.value,
        price: Number(form.price.value) || 0,
        area: Number(form.area.value) || 0,
        bedrooms: Number(form.bedrooms.value) || 0,
        bathrooms: Number(form.bathrooms.value) || 0,
        location: form.location.value.trim(),
        description: form.description.value.trim(),
        overview: form.overview.value.trim(),
        photo: pendingPhoto,
        stockPhoto: '',
        featured: form.featured.checked,
        createdAt: Date.now()
      });
      form.reset();
      photoPreview.style.display = 'none';
      pendingPhoto = '';
      msg.textContent = 'Property added.';
      showToast('Listing added.');
      await Promise.all([renderStats(), renderInventory()]);
    }catch(err){
      msg.textContent = err.message || 'Could not save the listing — try again.';
    }finally{
      submitBtn.disabled = false;
    }
  });

  async function renderStats(){
    const statsEl = document.getElementById('stats');
    const [visits, leads, listings] = await Promise.all([
      Store.getVisits(), Store.getLeads(), Store.getListings()
    ]);
    const conversion = visits.length ? Math.round((leads.length / visits.length) * 100) : 0;

    statsEl.innerHTML = `
      <div class="glass stat"><span>Total page views</span><strong>${visits.length}</strong></div>
      <div class="glass stat"><span>Enquiries received</span><strong>${leads.length}</strong></div>
      <div class="glass stat"><span>Active listings</span><strong>${listings.length}</strong></div>
      <div class="glass stat"><span>Visit-to-enquiry rate</span><strong>${conversion}%</strong></div>
    `;
  }

  async function renderInventory(){
    const el = document.getElementById('propertiesAdmin');
    el.innerHTML = '<p class="empty-state">Loading…</p>';
    const listings = await Store.getListings();

    el.innerHTML = listings.map(l => `
      <div class="inventory-row">
        <div class="inventory-thumb" style="background-image:url('${listingImage(l)}')"></div>
        <div class="inventory-meta">
          <strong>${escapeHtml(l.title)}</strong>
          <span>${escapeHtml(l.location)} · ${formatPrice(l.price, l.status)} · ${l.status}</span>
        </div>
        <button class="glass-btn small-btn" data-remove="${l.id}" style="color:#a8412f; border-color:rgba(176,72,60,0.4);">Remove</button>
      </div>
    `).join('') || '<p class="empty-state">No properties yet — add your first one.</p>';

    el.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Removing…';
        try{
          await Store.removeListing(btn.dataset.remove);
          showToast('Listing removed.');
          await Promise.all([renderInventory(), renderStats()]);
        }catch(err){
          showToast(err.message || 'Could not remove the listing.');
          btn.disabled = false;
          btn.textContent = 'Remove';
        }
      });
    });
  }

  async function renderLeads(){
    const el = document.getElementById('leads');
    el.innerHTML = '<p class="empty-state">Loading…</p>';
    const leads = await Store.getLeads();

    if(!leads.length){
      el.innerHTML = '<p class="empty-state">No enquiries yet — they will appear here as visitors send them.</p>';
      return;
    }
    el.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Name</th><th>Phone</th><th>Interested in</th><th>Message</th><th>Received</th></tr></thead>
        <tbody>
          ${leads.map(l => `
            <tr>
              <td>${escapeHtml(l.name)}</td>
              <td>${escapeHtml(l.phone)}</td>
              <td>${escapeHtml(l.listingTitle)}</td>
              <td>${escapeHtml(l.message) || '—'}</td>
              <td>${new Date(l.at).toLocaleDateString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  async function renderAnalytics(){
    const el = document.getElementById('analytics');
    el.innerHTML = '<p class="empty-state">Loading…</p>';
    const visits = await Store.getVisits();

    if(!visits.length){
      el.innerHTML = '<p class="empty-state">No page views recorded yet.</p>';
      return;
    }
    const counts = {};
    visits.forEach(v => { counts[v.page] = (counts[v.page] || 0) + 1; });
    const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]);
    const max = entries[0][1];

    el.innerHTML = entries.map(([page, count]) => `
      <div style="margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; font-size:0.86rem; margin-bottom:6px;">
          <span style="color:var(--text-dim);">${page}</span>
          <span style="color:var(--gold);">${count}</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${(count/max)*100}%"></div></div>
      </div>
    `).join('');
  }
});
