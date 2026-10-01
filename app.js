/* ============================================================
   R-HVAP Application — Frontend Logic
   ============================================================ */

// ---------- Configuration ----------
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'pdf'];
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];
const DRAFT_KEY = 'rhvap_draft_v1';
const SUBMIT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const MIN_FILL_TIME_MS = 20 * 1000; // 20 seconds

// ---------- Document definitions ----------
const DOCUMENTS = [
  { id: 'docCitizenship', label: 'नागरिकता/राष्ट्रिय परिचयपत्रको प्रतिलिपि', en: 'Copy of Citizenship/National ID', required: true, checklist: 'क' },
  { id: 'docRegCert', label: 'संस्था दर्ता प्रमाणपत्र तथा नविकरणको प्रतिलिपि', en: 'Organization registration certificate and renewal copy', required: true, checklist: 'ख' },
  { id: 'docPAN', label: 'स्थायी लेखा नम्बर तथा कर चुक्ता पत्र', en: 'PAN and Tax Clearance Certificate', required: true, checklist: 'ग' },
  { id: 'docAgreement', label: 'उत्पादक समूह/सहकारी/व्यवसायीसँगको सम्झौता समझदारीको पत्र', en: 'Agreement/MoU with producer group/cooperative/business', required: true, checklist: 'घ' },
  { id: 'docAudit', label: 'गत आर्थिक वर्षको लेखापरीक्षण प्रतिवेदन', en: 'Audit report of last fiscal year', required: true, checklist: 'ङ' },
  { id: 'docSource', label: 'सहलगानीको लागि श्रोत खुल्ने कागजात', en: 'Source of co-investment proof', required: true, checklist: 'च' },
  { id: 'docDesign', label: 'निर्माण गरिने पूर्वाधारको डिजाइन तथा इस्टिमेट', en: 'Design and estimate of planned infrastructure', required: true, checklist: 'छ' },
  { id: 'docOtherDonor', label: 'अन्य दाताहरूबाट अनुदान लिएको वा लिन पहल भए नभएको स्वघोषणा', en: 'Self-declaration regarding other donor grants', required: true, checklist: 'ज' },
  { id: 'docSchedule', label: 'लगानी कार्यक्रमको कार्यान्वयन तालिका', en: 'Implementation schedule', required: true, checklist: 'झ' },
  { id: 'docOther', label: 'अन्य भए खुलाउने (वैकल्पिक, धेरै फाइल अनुमति)', en: 'Other documents (optional, multiple allowed)', required: false, checklist: 'ञ', multiple: true },
  // Additional required documents from the notice not in the checklist but required
  { id: 'docBusinessReg', label: 'व्यवसाय दर्ताको प्रमाणपत्र (अद्यावधिक)', en: 'Business/Firm/Company registration certificate (with renewal)', required: true },
  { id: 'docVAT', label: 'प्यान वा भ्याट दर्ता प्रमाणपत्र', en: 'PAN/VAT certificate', required: true },
  { id: 'docTaxClear', label: 'कर चुक्ता प्रमाणपत्र (पछिल्लो आर्थिक वर्ष)', en: 'Tax clearance certificate (latest FY; Window-3: last two years)', required: true },
  { id: 'docMoA', label: 'प्रबन्धपत्र र नियमावली (कम्पनीको हकमा)', en: 'MoA/AoA (for companies)', required: false },
  { id: 'docLand', label: 'जग्गा धनी प्रमाणपूर्जा / भाडा सम्झौता', en: 'Land ownership proof / lease for infrastructure site', required: true },
  { id: 'docNoDouble', label: 'दोहोरो सुविधा नलिएको स्व-घोषणा पत्र', en: 'Self-declaration of no double benefit', required: true },
  { id: 'docNotBlacklisted', label: 'कालोसूचीमा नपरेको प्रमाण (CIB वा सरकारी निकाय)', en: 'Proof of not being blacklisted (CIB or government)', required: true },
  { id: 'docCommitment', label: 'स्व-घोषणा वा प्रतिबद्धता पत्र (Commitment Letter)', en: 'Commitment letter for own share of cost', required: true },
];

// ---------- State ----------
let uploadedFiles = {}; // id -> array of { file, name, size, type }
let formStartTime = Date.now();

// ---------- Language toggle ----------
function setLanguage(lang) {
  document.querySelectorAll('[data-en]').forEach(el => {
    const en = el.getAttribute('data-en');
    if (!el.dataset.ne) el.dataset.ne = el.textContent;
    el.textContent = lang === 'en' ? en : el.dataset.ne;
  });
  document.querySelectorAll('[data-en-placeholder]').forEach(el => {
    const en = el.getAttribute('data-en-placeholder');
    if (!el.dataset.nePlaceholder) el.dataset.nePlaceholder = el.placeholder;
    el.placeholder = lang === 'en' ? en : el.dataset.nePlaceholder;
  });
  localStorage.setItem('rhvap_lang', lang);
}

// ---------- Draft ----------
function saveDraft() {
  const form = document.getElementById('applicationForm');
  const data = {};
  new FormData(form).forEach((v, k) => {
    if (v instanceof File) return;
    data[k] = v;
  });
  data._uploadedIds = Object.keys(uploadedFiles);
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  const status = document.getElementById('draftStatus');
  status.textContent = '✓ ड्राफ्ट सुरक्षित भयो / Draft saved';
  setTimeout(() => status.textContent = '', 2500);
}

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    Object.keys(data).forEach(k => {
      const el = document.getElementById(k);
      if (el && k !== '_uploadedIds') {
        if (el.type === 'checkbox') el.checked = !!data[k];
        else el.value = data[k];
      }
    });
  } catch (e) { /* ignore */ }
}

// ---------- File handling ----------
function validateFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return { ok: false, msg: 'फाइल ढाँचा मान्य छैन। JPG, JPEG, PNG, PDF मात्र अनुमति छ। / Invalid file type. Only JPG, JPEG, PNG, PDF allowed.' };
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return { ok: false, msg: 'फाइलको MIME प्रकार मान्य छैन। / Invalid MIME type.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, msg: 'फाइल २ MB भन्दा ठूलो छ। / File is larger than 2 MB.' };
  }
  return { ok: true };
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function renderChips(containerId, docId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  (uploadedFiles[docId] || []).forEach((item, idx) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = `${item.name} <small>(${formatSize(item.size)})</small>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '×';
    btn.setAttribute('aria-label', 'Remove file');
    btn.onclick = () => {
      uploadedFiles[docId].splice(idx, 1);
      renderChips(containerId, docId);
    };
    chip.appendChild(btn);
    container.appendChild(chip);
  });
}

function buildUploadFields() {
  const wrap = document.getElementById('uploadFields');
  if (!wrap) return;
  wrap.innerHTML = '';
  DOCUMENTS.forEach(doc => {
    const div = document.createElement('div');
    div.className = 'upload-item ' + (doc.required ? 'required' : 'optional');
    div.innerHTML = `
      <label for="${doc.id}">${doc.label} <span class="en-sub">${doc.en}</span></label>
      <input type="file" id="${doc.id}" name="${doc.id}" accept=".jpg,.jpeg,.png,.pdf" ${doc.multiple ? 'multiple' : ''}>
      <div class="hint">JPG, JPEG, PNG, PDF — Max 2 MB</div>
      <div class="file-chips" id="${doc.id}Chips"></div>
      <div class="file-error" id="${doc.id}Error" hidden></div>
    `;
    wrap.appendChild(div);

    const input = div.querySelector('input[type=file]');
    input.addEventListener('change', () => {
      const errEl = document.getElementById(doc.id + 'Error');
      errEl.hidden = true;
      const files = Array.from(input.files);
      if (!files.length) return;
      if (!doc.multiple && files.length > 1) {
        errEl.textContent = 'एक फाइल मात्र अपलोड गर्नुहोस्। / Only one file allowed.';
        errEl.hidden = false;
        input.value = '';
        return;
      }
      if (!uploadedFiles[doc.id]) uploadedFiles[doc.id] = [];
      for (const f of files) {
        const v = validateFile(f);
        if (!v.ok) {
          errEl.textContent = v.msg;
          errEl.hidden = false;
          input.value = '';
          return;
        }
        uploadedFiles[doc.id].push({ file: f, name: f.name, size: f.size, type: f.type });
      }
      renderChips(doc.id + 'Chips', doc.id);
      input.value = '';
    });
  });
}

// ---------- Checklist ----------
function buildChecklist() {
  const grid = document.getElementById('checklistGrid');
  if (!grid) return;
  grid.innerHTML = '';
  DOCUMENTS.filter(d => d.checklist).forEach(doc => {
    const label = document.createElement('label');
    label.className = 'checklist-item';
    label.innerHTML = `<input type="checkbox" data-doc="${doc.id}"> <span>${doc.checklist}. ${doc.label}</span>`;
    grid.appendChild(label);
  });
  // Sync checkbox with upload presence
  grid.addEventListener('change', e => {
    if (e.target.matches('input[type=checkbox]')) {
      const docId = e.target.dataset.doc;
      if (e.target.checked && (!uploadedFiles[docId] || !uploadedFiles[docId].length)) {
        // just a visual tick; upload still required
      }
    }
  });
}

// ---------- Investment table ----------
function addInvestmentRow() {
  const tbody = document.getElementById('investmentBody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="sn"></td>
    <td><input type="text" class="inv-activity" data-en-placeholder="Activity"></td>
    <td><input type="text" class="inv-unit" data-en-placeholder="Unit"></td>
    <td><input type="text" class="inv-qty" inputmode="decimal"></td>
    <td><input type="text" class="inv-rate" inputmode="decimal"></td>
    <td><input type="text" class="inv-total" readonly></td>
    <td><input type="text" class="inv-msme" inputmode="decimal"></td>
    <td><input type="text" class="inv-rhvap" inputmode="decimal"></td>
    <td><input type="text" class="inv-remark"></td>
    <td><button type="button" class="btn btn-small remove-row">×</button></td>
  `;
  tbody.appendChild(tr);
  renumberRows();
  attachRowEvents(tr);
}

function renumberRows() {
  document.querySelectorAll('#investmentBody tr').forEach((tr, i) => {
    tr.querySelector('.sn').textContent = i + 1;
  });
}

function attachRowEvents(tr) {
  const qty = tr.querySelector('.inv-qty');
  const rate = tr.querySelector('.inv-rate');
  const total = tr.querySelector('.inv-total');
  const msme = tr.querySelector('.inv-msme');
  const rhvap = tr.querySelector('.inv-rhvap');

  function calcTotal() {
    const q = parseFloat(qty.value) || 0;
    const r = parseFloat(rate.value) || 0;
    total.value = (q * r).toFixed(2);
    updateTotals();
  }
  qty.addEventListener('input', calcTotal);
  rate.addEventListener('input', calcTotal);
  msme.addEventListener('input', updateTotals);
  rhvap.addEventListener('input', updateTotals);

  tr.querySelector('.remove-row').addEventListener('click', () => {
    tr.remove();
    renumberRows();
    updateTotals();
  });
}

function updateTotals() {
  let totalCost = 0, totalMSME = 0, totalRHVAP = 0;
  document.querySelectorAll('#investmentBody tr').forEach(tr => {
    totalCost += parseFloat(tr.querySelector('.inv-total').value) || 0;
    totalMSME += parseFloat(tr.querySelector('.inv-msme').value) || 0;
    totalRHVAP += parseFloat(tr.querySelector('.inv-rhvap').value) || 0;
  });
  document.getElementById('totalCost').textContent = totalCost.toFixed(2);
  document.getElementById('totalMSME').textContent = totalMSME.toFixed(2);
  document.getElementById('totalRHVAP').textContent = totalRHVAP.toFixed(2);

  const sum = totalMSME + totalRHVAP;
  const pctMSME = sum > 0 ? (totalMSME / sum * 100) : 0;
  const pctRHVAP = sum > 0 ? (totalRHVAP / sum * 100) : 0;
  document.getElementById('pctMSME').textContent = pctMSME.toFixed(1) + '%';
  document.getElementById('pctRHVAP').textContent = pctRHVAP.toFixed(1) + '%';

  const warn = document.getElementById('shareWarning');
  if (pctRHVAP > 50) {
    warn.hidden = false;
    warn.textContent = '⚠ R-HVAP को सह-लगानी ५०% भन्दा बढी छ। कृपया जाँच गर्नुहोस्। / Warning: R-HVAP share exceeds 50%. Please review.';
  } else {
    warn.hidden = true;
  }
}

// ---------- Validation ----------
function validateForm() {
  const errors = [];
  const form = document.getElementById('applicationForm');

  // Required fields
  form.querySelectorAll('[required]').forEach(el => {
    if (el.type === 'checkbox' && !el.checked) {
      errors.push('कृपया सहमति जनाउनुहोस्। / Please agree to the declaration.');
    } else if (el.type !== 'checkbox' && !el.value.trim()) {
      const label = el.previousElementSibling?.textContent || el.name;
      errors.push(`कृपया ${label} भर्नुहोस्। / Please fill ${label}`);
    }
  });

  // PAN 9 digits
  const pan = document.getElementById('pan').value.trim();
  if (pan && !/^\d{9}$/.test(pan)) {
    errors.push('PAN ९ अंकको हुनुपर्छ। / PAN must be 9 digits.');
  }

  // Phone
  const phone = document.getElementById('phone').value.trim();
  if (phone && !/^(97|98)\d{8}$/.test(phone) && !/^0\d{1,2}\d{6,7}$/.test(phone)) {
    errors.push('मान्य नेपाली मोबाइल वा ल्यान्डलाइन नम्बर भर्नुहोस्। / Enter a valid Nepali mobile or landline number.');
  }

  // Email
  const email = document.getElementById('email').value.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('मान्य इमेल ठेगाना भर्नुहोस्। / Enter a valid email address.');
  }

  // Required files
  DOCUMENTS.filter(d => d.required).forEach(d => {
    if (!uploadedFiles[d.id] || !uploadedFiles[d.id].length) {
      errors.push(`कृपया ${d.label} अपलोड गर्नुहोस्। / Please upload ${d.en}`);
    }
  });

  // Honeypot
  if (document.getElementById('website').value) {
    errors.push('Bot detected.');
  }

  // Time check
  const elapsed = Date.now() - formStartTime;
  if (elapsed < MIN_FILL_TIME_MS) {
    errors.push('कृपया फारम भर्न समय लिनुहोस्। / Please take your time to fill the form.');
  }

  // Repeat submission check
  const lastSubmit = localStorage.getItem('rhvap_last_submit');
  if (lastSubmit) {
    const diff = Date.now() - parseInt(lastSubmit, 10);
    if (diff < SUBMIT_COOLDOWN_MS) {
      errors.push('तपाईंले भर्खरै आवेदन पेश गर्नुभएको छ। कृपया केही समय पर्खनुहोस्। / You recently submitted. Please wait a few minutes.');
    }
  }

  return errors;
}

// ---------- Submission ----------
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function collectFormData() {
  const form = document.getElementById('applicationForm');
  const data = {};
  new FormData(form).forEach((v, k) => {
    if (v instanceof File) return;
    data[k] = v;
  });

  // Activity list
  data.activities = Array.from(document.querySelectorAll('.activity-input'))
    .map(i => i.value.trim()).filter(Boolean);

  // Investment rows
  data.investmentRows = [];
  document.querySelectorAll('#investmentBody tr').forEach(tr => {
    data.investmentRows.push({
      sn: tr.querySelector('.sn').textContent,
      activity: tr.querySelector('.inv-activity').value,
      unit: tr.querySelector('.inv-unit').value,
      quantity: tr.querySelector('.inv-qty').value,
      rate: tr.querySelector('.inv-rate').value,
      total: tr.querySelector('.inv-total').value,
      msme: tr.querySelector('.inv-msme').value,
      rhvap: tr.querySelector('.inv-rhvap').value,
      remark: tr.querySelector('.inv-remark').value,
    });
  });

  // Files as base64
  data.files = {};
  for (const [docId, arr] of Object.entries(uploadedFiles)) {
    if (!arr.length) continue;
    data.files[docId] = [];
    for (const item of arr) {
      const b64 = await fileToBase64(item.file);
      data.files[docId].push({
        name: item.name,
        size: item.size,
        type: item.type,
        data: b64,
      });
    }
  }

  return data;
}

async function submitForm(e) {
  e.preventDefault();
  const errorBox = document.getElementById('formError');
  errorBox.hidden = true;

  const errors = validateForm();
  if (errors.length) {
    errorBox.innerHTML = errors.map(err => `<div>• ${err}</div>`).join('');
    errorBox.hidden = false;
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  const spinner = document.getElementById('loadingSpinner');
  const retryBtn = document.getElementById('retryBtn');
  submitBtn.disabled = true;
  spinner.hidden = false;
  retryBtn.hidden = true;

  try {
    const payload = await collectFormData();
    payload._submittedAt = new Date().toISOString();

    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!result.success) throw new Error(result.message || 'Submission failed');

    // Show success
    localStorage.setItem('rhvap_last_submit', Date.now().toString());
    document.getElementById('applicationForm').hidden = true;
    document.querySelector('.form-actions-top').hidden = true;
    document.getElementById('progressBar').style.width = '100%';

    const success = document.getElementById('successView');
    success.hidden = false;
    document.getElementById('refNumberDisplay').textContent = result.referenceNumber;

    // Summary
    const summary = document.getElementById('summaryDisplay');
    summary.innerHTML = `
      <dl>
        <dt>फर्म/संस्थाको नाम / Firm Name</dt><dd>${escapeHtml(payload.firmName || '')}</dd>
        <dt>विन्डो / Window</dt><dd>${escapeHtml(payload.window || '')}</dd>
        <dt>सम्पर्क फोन / Phone</dt><dd>${escapeHtml(payload.phone || '')}</dd>
        <dt>इमेल / Email</dt><dd>${escapeHtml(payload.email || '')}</dd>
        <dt>कुल लगानी / Total Investment</dt><dd>${escapeHtml(payload.totalInvestmentNum || '')}</dd>
      </dl>
    `;
    success.scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    errorBox.textContent = '❌ पेश गर्न असफल भयो। कृपया पुनः प्रयास गर्नुहोस्। / Submission failed. Please retry.';
    errorBox.hidden = false;
    retryBtn.hidden = false;
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    spinner.hidden = true;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  formStartTime = Date.now();
  document.getElementById('formStartTime').value = formStartTime;

  // Language
  const savedLang = localStorage.getItem('rhvap_lang') || 'ne';
  document.getElementById('langBtn').addEventListener('click', () => {
    const current = localStorage.getItem('rhvap_lang') || 'ne';
    const next = current === 'ne' ? 'en' : 'ne';
    localStorage.setItem('rhvap_lang', next);
    setLanguage(next);
    document.getElementById('langBtn').textContent = next === 'ne' ? 'English' : 'नेपाली';
  });
  setLanguage(savedLang);
  document.getElementById('langBtn').textContent = savedLang === 'ne' ? 'English' : 'नेपाली';

  // Build UI
  buildChecklist();
  buildUploadFields();
  addInvestmentRow();
  addInvestmentRow();
  addInvestmentRow();

  // Events
  document.getElementById('addRowBtn').addEventListener('click', addInvestmentRow);
  document.getElementById('saveDraftBtn').addEventListener('click', saveDraft);
  document.getElementById('applicationForm').addEventListener('submit', submitForm);
  document.getElementById('retryBtn').addEventListener('click', () => {
    document.getElementById('retryBtn').hidden = true;
    document.getElementById('applicationForm').requestSubmit();
  });

  // Load draft
  loadDraft();

  // Progress bar
  const form = document.getElementById('applicationForm');
  form.addEventListener('input', () => {
    const inputs = form.querySelectorAll('input, select, textarea');
    let filled = 0;
    inputs.forEach(i => {
      if (i.type === 'checkbox' ? i.checked : i.value.trim()) filled++;
    });
    const pct = Math.min(100, (filled / inputs.length) * 100);
    document.getElementById('progressBar').style.width = pct + '%';
  });

  // Auto-save every 30 seconds
  setInterval(saveDraft, 30000);
});