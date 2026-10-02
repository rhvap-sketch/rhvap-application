/* ============================================================
   R-HVAP Application — Frontend Logic
   ============================================================ */

// ---------- Configuration ----------
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'pdf'];
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];
const DRAFT_KEY = 'rhvap_draft_v1';
const SUBMIT_COOLDOWN_MS = 5 * 60 * 1000;
const MIN_FILL_TIME_MS = 20 * 1000;

// ---------- Document definitions ----------
// NOTE: docAnnex11 is the NEW entry added at the top (अनुसूची १.१ upload)
const DOCUMENTS = [
  { id: 'docAnnex11', label: 'अनुसूची १.१ आवेदन फारम (हस्ताक्षर/छाप सहित)', en: 'Annex 1.1 Application Form (signed & stamped)', required: true },
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
  { id: 'docBusinessReg', label: 'व्यवसाय दर्ताको प्रमाणपत्र (अद्यावधिक)', en: 'Business/Firm/Company registration certificate', required: true },
  { id: 'docVAT', label: 'प्यान वा भ्याट दर्ता प्रमाणपत्र', en: 'PAN/VAT certificate', required: true },
  { id: 'docTaxClear', label: 'कर चुक्ता प्रमाणपत्र (पछिल्लो आर्थिक वर्ष)', en: 'Tax clearance certificate', required: true },
  { id: 'docMoA', label: 'प्रबन्धपत्र र नियमावली (कम्पनीको हकमा)', en: 'MoA/AoA (for companies)', required: false },
  { id: 'docLand', label: 'जग्गा धनी प्रमाणपूर्जा / भाडा सम्झौता', en: 'Land ownership proof / lease', required: true },
  { id: 'docNoDouble', label: 'दोहोरो सुविधा नलिएको स्व-घोषणा पत्र', en: 'Self-declaration of no double benefit', required: true },
  { id: 'docNotBlacklisted', label: 'कालोसूचीमा नपरेको प्रमाण (CIB वा सरकारी निकाय)', en: 'Proof of not being blacklisted', required: true },
  { id: 'docCommitment', label: 'स्व-घोषणा वा प्रतिबद्धता पत्र (Commitment Letter)', en: 'Commitment letter for own share', required: true },
];

let uploadedFiles = {};
let formStartTime = Date.now();

/* ============ NEPALI (B.S.) DATE PICKER ============ */
function initNepaliDatePickers() {
  if (typeof NepaliDatePicker === 'undefined') {
    console.warn('Nepali date picker not loaded. Date fields fall back to text input.');
    return;
  }
  document.querySelectorAll('[data-np-date]').forEach(el => {
    try {
      new NepaliDatePicker('#' + el.id, {
        format: 'YYYY/MM/DD',
        inline: false,
        maxYear: 2090,
        minYear: 2020,
        closeOnSelect: true,
      });
      el.setAttribute('autocomplete', 'off');
      el.setAttribute('inputmode', 'numeric');
    } catch (e) {
      console.warn('Date picker init failed for #' + el.id, e);
    }
  });
}

/* ============ LANGUAGE ============ */
function setLanguage(lang) {
  document.body.classList.remove('lang-ne', 'lang-en');
  document.body.classList.add(lang === 'en' ? 'lang-en' : 'lang-ne');

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

/* ============ DRAFT ============ */
function saveDraft() {
  const form = document.getElementById('applicationForm');
  if (!form) return;
  const data = {};
  new FormData(form).forEach((v, k) => {
    if (v instanceof File) return;
    data[k] = v;
  });
  data._uploadedIds = Object.keys(uploadedFiles);
  data._activities = Array.from(document.querySelectorAll('.activity-input')).map(i => i.value);
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  const status = document.getElementById('draftStatus');
  if (status) {
    status.textContent = '✓ ड्राफ्ट सुरक्षित भयो / Draft saved';
    setTimeout(() => status.textContent = '', 2500);
  }
}

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    Object.keys(data).forEach(k => {
      if (k.startsWith('_')) return;
      const el = document.getElementById(k);
      if (el) {
        if (el.type === 'checkbox') el.checked = !!data[k];
        else el.value = data[k];
      }
    });
    if (Array.isArray(data._activities)) {
      const inputs = document.querySelectorAll('.activity-input');
      data._activities.forEach((v, i) => { if (inputs[i]) inputs[i].value = v; });
    }
  } catch (e) { /* ignore */ }
}

/* ============ FILE HANDLING ============ */
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

/* ============ CHECKLIST ============ */
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
}

/* ============ INVESTMENT TABLE ============ */
function addInvestmentRow() {
  const tbody = document.getElementById('investmentBody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="sn"></td>
    <td><input type="text" class="inv-activity"></td>
    <td><input type="text" class="inv-unit"></td>
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
    const q = parseFloat(toEnglishDigits(qty.value)) || 0;
    const r = parseFloat(toEnglishDigits(rate.value)) || 0;
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

function toEnglishDigits(s) {
  const map = { '०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9' };
  return String(s).replace(/[०-९]/g, d => map[d]);
}

function updateTotals() {
  let totalCost = 0, totalMSME = 0, totalRHVAP = 0;
  document.querySelectorAll('#investmentBody tr').forEach(tr => {
    totalCost += parseFloat(toEnglishDigits(tr.querySelector('.inv-total').value)) || 0;
    totalMSME += parseFloat(toEnglishDigits(tr.querySelector('.inv-msme').value)) || 0;
    totalRHVAP += parseFloat(toEnglishDigits(tr.querySelector('.inv-rhvap').value)) || 0;
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

/* ============ VALIDATION ============ */
function validateForm() {
  const errors = [];
  const form = document.getElementById('applicationForm');
  if (!form) return errors;

  form.querySelectorAll('[required]').forEach(el => {
    if (el.type === 'checkbox' && !el.checked) {
      errors.push('कृपया सहमति जनाउनुहोस्। / Please agree to the declaration.');
    } else if (el.type !== 'checkbox' && !el.value.trim()) {
      const label = el.previousElementSibling?.textContent || el.name;
      errors.push(`कृपया ${label} भर्नुहोस्। / Please fill ${label}`);
    }
  });

  const pan = document.getElementById('pan')?.value.trim() || '';
  if (pan && !/^\d{9}$/.test(toEnglishDigits(pan))) {
    errors.push('PAN ९ अंकको हुनुपर्छ। / PAN must be 9 digits.');
  }

  const phone = document.getElementById('phone')?.value.trim() || '';
  if (phone && !/^(97|98)\d{8}$/.test(toEnglishDigits(phone)) && !/^0\d{1,2}\d{6,7}$/.test(toEnglishDigits(phone))) {
    errors.push('मान्य नेपाली मोबाइल वा ल्यान्डलाइन नम्बर भर्नुहोस्। / Enter a valid Nepali mobile or landline number.');
  }

  const email = document.getElementById('email')?.value.trim() || '';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('मान्य इमेल ठेगाना भर्नुहोस्। / Enter a valid email address.');
  }

  DOCUMENTS.filter(d => d.required).forEach(d => {
    if (!uploadedFiles[d.id] || !uploadedFiles[d.id].length) {
      errors.push(`कृपया ${d.label} अपलोड गर्नुहोस्। / Please upload ${d.en}`);
    }
  });

  const hp = document.getElementById('website');
  if (hp && hp.value) errors.push('Bot detected.');

  if (Date.now() - formStartTime < MIN_FILL_TIME_MS) {
    errors.push('कृपया फारम भर्न समय लिनुहोस्। / Please take your time to fill the form.');
  }

  const lastSubmit = localStorage.getItem('rhvap_last_submit');
  if (lastSubmit && (Date.now() - parseInt(lastSubmit, 10)) < SUBMIT_COOLDOWN_MS) {
    errors.push('तपाईंले भर्खरै आवेदन पेश गर्नुभएको छ। कृपया केही समय पर्खनुहोस्। / You recently submitted. Please wait a few minutes.');
  }

  return errors;
}

/* ============ SUBMISSION ============ */
function fileToBase64(file) {
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

  data.activities = Array.from(document.querySelectorAll('.activity-input'))
    .map(i => i.value.trim()).filter(Boolean);

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

  data.files = {};
  for (const [docId, arr] of Object.entries(uploadedFiles)) {
    if (!arr.length) continue;
    data.files[docId] = [];
    for (const item of arr) {
      const b64 = await fileToBase64(item.file);
      data.files[docId].push({
        name: item.name, size: item.size, type: item.type, data: b64,
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

  if (typeof APPS_SCRIPT_URL === 'undefined' || APPS_SCRIPT_URL.includes('PASTE_YOUR')) {
    errorBox.textContent = '❌ कन्फिगरेसन त्रुटि: config.js मा Apps Script URL राख्नुहोस्। / Config error: Add Apps Script URL in config.js.';
    errorBox.hidden = false;
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

    localStorage.setItem('rhvap_last_submit', Date.now().toString());
    document.getElementById('applicationForm').hidden = true;
    const topActions = document.querySelector('.form-actions-top');
    if (topActions) topActions.hidden = true;
    const pb = document.getElementById('progressBar');
    if (pb) pb.style.width = '100%';

    const success = document.getElementById('successView');
    success.hidden = false;
    document.getElementById('refNumberDisplay').textContent = result.referenceNumber;

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

/* ============ INIT ============ */
document.addEventListener('DOMContentLoaded', () => {
  formStartTime = Date.now();
  const fst = document.getElementById('formStartTime');
  if (fst) fst.value = formStartTime;

  // Language init
  const savedLang = localStorage.getItem('rhvap_lang') || 'ne';
  document.body.classList.remove('lang-ne', 'lang-en');
  document.body.classList.add(savedLang === 'en' ? 'lang-en' : 'lang-ne');

  const langBtn = document.getElementById('langBtn');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      const current = localStorage.getItem('rhvap_lang') || 'ne';
      const next = current === 'ne' ? 'en' : 'ne';
      localStorage.setItem('rhvap_lang', next);
      setLanguage(next);
      langBtn.textContent = next === 'ne' ? 'English' : 'नेपाली';
    });
    setLanguage(savedLang);
    langBtn.textContent = savedLang === 'ne' ? 'English' : 'नेपाली';
  }

  // Build UI on apply page
  if (document.getElementById('applicationForm')) {
    buildChecklist();
    buildUploadFields();
    addInvestmentRow();
    addInvestmentRow();
    addInvestmentRow();

    const addRowBtn = document.getElementById('addRowBtn');
    if (addRowBtn) addRowBtn.addEventListener('click', addInvestmentRow);

    const saveDraftBtn = document.getElementById('saveDraftBtn');
    if (saveDraftBtn) saveDraftBtn.addEventListener('click', saveDraft);

    const form = document.getElementById('applicationForm');
    form.addEventListener('submit', submitForm);

    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) retryBtn.addEventListener('click', () => {
      retryBtn.hidden = true;
      form.requestSubmit();
    });

    // Progress bar
    form.addEventListener('input', () => {
      const inputs = form.querySelectorAll('input, select, textarea');
      let filled = 0;
      inputs.forEach(i => {
        if (i.type === 'checkbox' ? i.checked : i.value.trim()) filled++;
      });
      const pct = Math.min(100, (filled / inputs.length) * 100);
      const pb = document.getElementById('progressBar');
      if (pb) pb.style.width = pct + '%';
    });

    // Add activity button
    const addActivityBtn = document.getElementById('addActivityBtn');
    if (addActivityBtn) addActivityBtn.addEventListener('click', () => {
      const container = document.getElementById('activityList');
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'activity-input';
      input.placeholder = 'Activity ' + (container.children.length + 1);
      container.appendChild(input);
    });

    // Load draft
    loadDraft();

    // B.S. date pickers
    initNepaliDatePickers();

    // Auto-save every 30 seconds
    setInterval(saveDraft, 30000);
  }
});
