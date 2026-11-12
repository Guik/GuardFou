import { t, uiLanguage } from '../shared/i18n.js';

const BAND_LABELS = { green: t('bandGreen'), orange: t('bandOrange'), red: t('bandRed') };
const DATE_FORMAT = new Intl.DateTimeFormat(uiLanguage(), { year: 'numeric', month: 'long', day: 'numeric' });
const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

let currentTabId = null;

async function main() {
  const hasAccess = await browser.permissions.contains({ origins: ['<all_urls>'] });
  if (!hasAccess) {
    show('activate');
    document.getElementById('activate-btn').addEventListener('click', async () => {
      const granted = await browser.permissions.request({ origins: ['<all_urls>'] });
      if (granted) window.location.reload();
    });
    return;
  }

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    show('empty');
    return;
  }
  currentTabId = tab.id;
  document.getElementById('identity-toggle').hidden = false;

  const verdict = await browser.runtime.sendMessage({ type: 'GET_VERDICT', tabId: tab.id });
  if (!verdict) {
    show('empty');
    return;
  }

  show('result');
  renderScore(verdict);
}

function renderScore(verdict) {
  const ring = document.getElementById('score-ring');
  ring.className = `score-ring ${verdict.band}`;

  const progress = document.getElementById('ring-progress');
  progress.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  progress.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;
  // Set to full offset first, then animate to the real value on the next
  // frame so the ring fills in on open instead of appearing already full.
  requestAnimationFrame(() => {
    progress.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - verdict.score / 100)}`;
  });

  document.getElementById('score-number').textContent = verdict.score;
  const bandLabel = document.getElementById('band-label');
  bandLabel.textContent = BAND_LABELS[verdict.band];
  bandLabel.className = `band-label ${verdict.band}`;
  document.getElementById('domain').textContent = verdict.domain;

  const list = document.getElementById('reasons');
  list.innerHTML = '';
  if (verdict.reasons.length === 0) {
    const li = document.createElement('li');
    li.textContent = t('popupNoReasons');
    list.appendChild(li);
  } else {
    for (const reason of verdict.reasons) {
      const li = document.createElement('li');
      li.textContent = reason.message;
      li.className = reason.weight > 0 ? 'weight-positive' : reason.weight < 0 ? 'weight-negative' : '';
      list.appendChild(li);
    }
  }

}

function show(sectionId) {
  for (const id of ['activate', 'result', 'empty']) {
    document.getElementById(id).hidden = id !== sectionId;
  }
}

function formatDate(isoString) {
  if (!isoString) return t('cardUnknownDate');
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? t('cardUnknownDate') : DATE_FORMAT.format(date);
}

function formatSiret(candidate) {
  const d = candidate.digits;
  return candidate.type === 'siret' ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}` : `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

// The ✓/! marker is part of the actual text (not a CSS ::before symbol), so
// it's included when the user copies/selects the list — CSS-generated
// content is invisible to copy/paste and to some screen readers.
function addChecklistItem(ul, label, ok) {
  const li = document.createElement('li');
  li.className = 'checklist-item';
  const marker = document.createElement('span');
  marker.className = ok ? 'seo-ok' : 'seo-fail';
  marker.textContent = ok ? '✓' : '!';
  li.append(marker, document.createTextNode(` ${label}`));
  ul.appendChild(li);
}

function addField(dl, term, buildDescription) {
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  buildDescription(dd);
  dl.append(dt, dd);
}

function renderIdentityCard(card) {
  const dl = document.getElementById('identity-fields');
  dl.innerHTML = '';

  addField(dl, t('cardRegistrationDate'), (dd) => { dd.textContent = formatDate(card.registrationDate); });
  addField(dl, t('cardLastChangedDate'), (dd) => { dd.textContent = formatDate(card.lastChangedDate); });
  addField(dl, t('cardExpirationDate'), (dd) => { dd.textContent = formatDate(card.expirationDate); });
  addField(dl, t('cardRegistrar'), (dd) => { dd.textContent = card.registrarName || t('cardUnknownRegistrar'); });

  addField(dl, t('cardAddress'), (dd) => {
    dd.textContent = card.address || t('cardAddressNotFound');
    if (!card.address) dd.className = 'muted';
  });

  addField(dl, t('cardTechnologies'), (dd) => {
    dd.textContent = card.technologies.length ? card.technologies.join(', ') : t('cardNotDetected');
    if (!card.technologies.length) dd.className = 'muted';
  });

  addField(dl, t('cardSocialLinks'), (dd) => {
    if (card.socialLinks.length === 0) {
      dd.textContent = t('cardNoSocialLinks');
      dd.className = 'muted';
      return;
    }
    const ul = document.createElement('ul');
    for (const link of card.socialLinks) {
      const li = document.createElement('li');
      li.textContent = link.platform;
      ul.appendChild(li);
    }
    dd.appendChild(ul);
  });

  addField(dl, t('cardLegalPages'), (dd) => {
    if (!card.legalUrls || card.legalUrls.length === 0) {
      dd.textContent = t('cardNoLegalLinks');
      dd.className = 'muted';
      return;
    }
    const ul = document.createElement('ul');
    for (const url of card.legalUrls) {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = url;
      link.textContent = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      li.appendChild(link);
      ul.appendChild(li);
    }
    dd.appendChild(ul);
  });

  addField(dl, t('cardLegalText'), (dd) => {
    const legal = card.legalText;
    if (!legal.present) {
      dd.textContent = t('cardLegalMissing');
      dd.className = 'warning';
      return;
    }
    const p = document.createElement('p');
    p.style.margin = '0';
    p.textContent = t('cardLegalPresent', legal.detectedLang === 'unknown' ? t('cardLanguageUnknown') : legal.detectedLang);
    dd.appendChild(p);

    const ul = document.createElement('ul');
    if (legal.languageMismatch) {
      const li = document.createElement('li');
      li.textContent = t('cardLanguageMismatch');
      li.className = 'warning';
      ul.appendChild(li);
    }
    if (legal.tooShort) {
      const li = document.createElement('li');
      li.textContent = t('cardLegalTooShort');
      li.className = 'warning';
      ul.appendChild(li);
    }
    if (ul.children.length === 0) {
      const li = document.createElement('li');
      li.textContent = t('cardLegalNothingToReport');
      li.className = 'muted';
      ul.appendChild(li);
    }
    dd.appendChild(ul);
  });

  addField(dl, t('cardMandatoryMentions'), (dd) => {
    const mentions = card.mandatoryMentions;
    if (!mentions) {
      dd.textContent = t('cardMandatoryUnchecked');
      dd.className = 'muted';
      return;
    }
    const ul = document.createElement('ul');
    for (const item of mentions.universal) {
      addChecklistItem(ul, t(`legalField_${item.key}`), item.present);
    }
    const sep = document.createElement('li');
    sep.textContent = t('cardDependsOnStatus');
    sep.className = 'muted';
    sep.style.marginTop = '6px';
    ul.appendChild(sep);
    for (const item of mentions.conditional) {
      addChecklistItem(ul, t(`legalField_${item.key}`), item.present);
    }
    dd.appendChild(ul);
  });

  addField(dl, t('cardCompanyCheck'), (dd) => {
    const check = card.companyCheck;
    if (!check?.candidate) {
      dd.textContent = t('cardNoCompanyNumber');
      dd.className = 'muted';
      return;
    }
    const ul = document.createElement('ul');
    const numberLi = document.createElement('li');
    numberLi.textContent = t('cardCompanyNumberFound', formatSiret(check.candidate));
    ul.appendChild(numberLi);

    if (check.checksumValid === false) {
      const li = document.createElement('li');
      li.textContent = t('cardCompanyNumberInvalid');
      li.className = 'warning';
      ul.appendChild(li);
    } else if (check.registry && !check.registry.found) {
      const li = document.createElement('li');
      li.textContent = t('cardCompanyNotFound');
      li.className = 'warning';
      ul.appendChild(li);
    } else if (check.registry?.found) {
      const statusLi = document.createElement('li');
      statusLi.textContent = t(check.registry.status === 'A' ? 'cardCompanyActive' : 'cardCompanyClosed', check.registry.name);
      statusLi.className = check.registry.status === 'A' ? 'seo-ok' : 'warning';
      ul.appendChild(statusLi);
    }
    dd.appendChild(ul);
  });

  addField(dl, t('cardSeo'), (dd) => {
    const ul = document.createElement('ul');
    for (const item of card.seoMetaSummary) {
      addChecklistItem(ul, item.label, item.ok);
    }
    dd.appendChild(ul);
  });

  addField(dl, t('cardPopularity'), (dd) => {
    dd.textContent = t('cardNotAvailableYet');
    dd.className = 'muted';
  });

  addField(dl, t('cardBacklinks'), (dd) => {
    dd.textContent = t('cardNotAvailableYet');
    dd.className = 'muted';
  });
}

document.getElementById('identity-btn').addEventListener('click', async () => {
  document.getElementById('identity-toggle').hidden = true;
  const identitySection = document.getElementById('identity');
  identitySection.hidden = false;
  document.getElementById('identity-loading').hidden = false;
  document.getElementById('identity-fields').hidden = true;

  const card = await browser.runtime.sendMessage({ type: 'GET_IDENTITY_CARD', tabId: currentTabId });
  document.getElementById('identity-loading').hidden = true;
  if (!card || card.needsReload) {
    document.getElementById('identity-loading').hidden = false;
    document.getElementById('identity-loading').textContent = t(card?.needsReload ? 'popupIdentityNeedsReload' : 'popupIdentityUnavailable');
    return;
  }
  renderIdentityCard(card);
  document.getElementById('identity-fields').hidden = false;

  // Opening the card can trigger checks the lighter automatic pass skipped
  // (e.g. a page that didn't look like a shop), which may change the real
  // score — refresh the headline view so it never contradicts the details
  // right below it.
  const verdict = await browser.runtime.sendMessage({ type: 'GET_VERDICT', tabId: currentTabId });
  if (verdict) {
    show('result');
    renderScore(verdict);
  }
});

document.getElementById('identity-close-btn').addEventListener('click', () => {
  document.getElementById('identity').hidden = true;
  document.getElementById('identity-toggle').hidden = false;
});

document.getElementById('options-link').addEventListener('click', (event) => {
  event.preventDefault();
  browser.runtime.openOptionsPage();
});

main();
