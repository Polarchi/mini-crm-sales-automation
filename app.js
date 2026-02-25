const STORAGE_KEY = "mini_crm_leads_v1";

const form = document.getElementById("leadForm");
const runAutomationBtn = document.getElementById("runAutomation");
const exportCsvBtn = document.getElementById("exportCsv");
const clearAllBtn = document.getElementById("clearAll");

const cols = {
  new: document.getElementById("col-new"),
  contacted: document.getElementById("col-contacted"),
  qualified: document.getElementById("col-qualified"),
  closed: document.getElementById("col-closed"),
  lost: document.getElementById("col-lost"),
};

const statsEl = document.getElementById("stats");
const notificationsEl = document.getElementById("notifications");


function nowISO() {
  return new Date().toISOString();
}

function daysBetween(isoA, isoB) {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  const diff = Math.abs(b - a);
  return diff / (1000 * 60 * 60 * 24);
}

function loadLeads() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLeads(leads) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function addNotification(text) {
  const li = document.createElement("li");
  li.textContent = text;
  notificationsEl.prepend(li);
}

function computeStats(leads) {
  const counts = { new: 0, contacted: 0, qualified: 0, closed: 0, lost: 0, followUp: 0 };
  for (const l of leads) {
    counts[l.stage] = (counts[l.stage] ?? 0) + 1;
    if (l.followUp) counts.followUp++;
  }
  return counts;
}

function renderStats(leads) {
  const s = computeStats(leads);
  statsEl.innerHTML = "";
  const items = [
    ["Total", leads.length],
    ["Nuevo", s.new],
    ["Contactado", s.contacted],
    ["Calificado", s.qualified],
    ["Cerrado", s.closed],
    ["Perdido", s.lost],
    ["Requiere seguimiento", s.followUp],
  ];
  for (const [k, v] of items) {
    const div = document.createElement("div");
    div.className = "stat";
    div.innerHTML = `<span>${k}</span><strong>${v}</strong>`;
    statsEl.appendChild(div);
  }
}

function moveStage(leads, id, nextStage) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return leads;
  lead.stage = nextStage;
  lead.updatedAt = nowISO();
  if (nextStage === "closed" || nextStage === "lost") lead.followUp = false;
  return leads;
}

function toggleFollowUp(leads, id) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return leads;
  lead.followUp = !lead.followUp;
  lead.updatedAt = nowISO();
  return leads;
}

function removeLead(leads, id) {
  return leads.filter(l => l.id !== id);
}

function leadCard(lead) {
  const div = document.createElement("div");
  div.className = "lead";

  const badge = lead.followUp
    ? `<span class="badge follow">Seguimiento</span>`
    : `<span class="badge">OK</span>`;

  div.innerHTML = `
    <div class="top">
      <strong>${lead.name}</strong>
      ${badge}
    </div>
    <div class="small">📱 ${lead.phone}</div>
    <div class="small">🎯 ${lead.interest}</div>
    <div class="small">🕒 Actualizado: ${new Date(lead.updatedAt).toLocaleString()}</div>
    <div class="actions">
      <button data-act="new">Nuevo</button>
      <button data-act="contacted">Contactado</button>
      <button data-act="qualified">Calificado</button>
      <button data-act="closed" class="primary">Cerrado</button>
      <button data-act="lost">Perdido</button>
      <button data-act="follow">Toggle seguimiento</button>
      <button data-act="del">Eliminar</button>
    </div>
  `;

  div.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const act = btn.getAttribute("data-act");
      let leads = loadLeads();

      if (["new", "contacted", "qualified", "closed", "lost"].includes(act)) {
        leads = moveStage(leads, lead.id, act);
        saveLeads(leads);
        addNotification(`Lead "${lead.name}" movido a "${act}".`);
        render();
        return;
      }

      if (act === "follow") {
        leads = toggleFollowUp(leads, lead.id);
        saveLeads(leads);
        addNotification(`Seguimiento actualizado para "${lead.name}".`);
        render();
        return;
      }

      if (act === "del") {
        leads = removeLead(leads, lead.id);
        saveLeads(leads);
        addNotification(`Lead "${lead.name}" eliminado.`);
        render();
      }
    });
  });

  return div;
}

function runAutomation() {
  const leads = loadLeads();
  const now = nowISO();
  let updated = 0;

  for (const l of leads) {
    const idleDays = daysBetween(l.updatedAt, now);
    const needs = (l.stage === "new" || l.stage === "contacted") && idleDays >= 2;
    if (needs && !l.followUp) {
      l.followUp = true;
      updated++;
    }
  }

  saveLeads(leads);
  addNotification(updated > 0
    ? `Automatización: ${updated} lead(s) marcados como "Requiere seguimiento".`
    : `Automatización: no hubo leads pendientes.`);
  render();
}

// ✅ NUEVO: Exportar a CSV
function exportToCSV() {
  const leads = loadLeads();

  if (!leads.length) {
    addNotification("No hay leads para exportar.");
    return;
  }

  const headers = ["name", "phone", "interest", "stage", "followUp", "createdAt", "updatedAt"];

  const escapeCSV = (value) => {
    const s = String(value ?? "");
    const escaped = s.replaceAll('"', '""');
    return `"${escaped}"`;
  };

  const rows = leads.map(l => headers.map(h => escapeCSV(l[h])).join(","));
  const csvContent = [headers.join(","), ...rows].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `leads_${date}.csv`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);

  addNotification(`CSV exportado (${leads.length} leads).`);
}

function render() {
  const leads = loadLeads();

  Object.values(cols).forEach(c => c.innerHTML = "");
  for (const l of leads) {
    cols[l.stage].appendChild(leadCard(l));
  }

  renderStats(leads);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const interest = document.getElementById("interest").value.trim();

  if (!name || !phone || !interest) return;

  const leads = loadLeads();
  leads.unshift({
    id: uid(),
    name,
    phone,
    interest,
    stage: "new",
    followUp: false,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });

  saveLeads(leads);
  form.reset();
  addNotification(`Lead "${name}" agregado.`);
  render();
});

runAutomationBtn.addEventListener("click", runAutomation);
exportCsvBtn.addEventListener("click", exportToCSV); // ✅ NUEVO

clearAllBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  notificationsEl.innerHTML = "";
  addNotification("Datos eliminados.");
  render();
});

render();