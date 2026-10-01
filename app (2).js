function setLanguage(lang) {
  // NEW: Set body font class
  document.body.classList.remove('lang-ne', 'lang-en');
  document.body.classList.add(lang === 'en' ? 'lang-en' : 'lang-ne');

  // ... rest of existing code ...
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