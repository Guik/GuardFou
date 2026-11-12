const BAND_LABELS = { green: 'Semble fiable', orange: 'Prudence', red: 'Risque élevé' };
const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
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
    li.textContent = 'Aucun signal particulier détecté.';
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
  if (!isoString) return 'Inconnue';
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? 'Inconnue' : DATE_FORMAT.format(date);
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

  addField(dl, 'Date de création du nom de domaine', (dd) => { dd.textContent = formatDate(card.registrationDate); });
  addField(dl, 'Dernière mise à jour du nom de domaine', (dd) => { dd.textContent = formatDate(card.lastChangedDate); });
  addField(dl, "Date d'expiration du nom de domaine", (dd) => { dd.textContent = formatDate(card.expirationDate); });
  addField(dl, "Bureau d'enregistrement", (dd) => { dd.textContent = card.registrarName || 'Inconnu'; });

  addField(dl, 'Adresse physique', (dd) => {
    dd.textContent = card.address || 'Non trouvée sur la page';
    if (!card.address) dd.className = 'muted';
  });

  addField(dl, 'Technologie utilisée', (dd) => {
    dd.textContent = card.technologies.length ? card.technologies.join(', ') : 'Non détectée';
    if (!card.technologies.length) dd.className = 'muted';
  });

  addField(dl, 'Réseaux sociaux', (dd) => {
    if (card.socialLinks.length === 0) {
      dd.textContent = 'Aucun lien trouvé';
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

  addField(dl, 'Page(s) analysée(s) pour les mentions légales', (dd) => {
    if (!card.legalUrls || card.legalUrls.length === 0) {
      dd.textContent = 'Aucun lien de mentions légales/CGV/CGU trouvé sur la page.';
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

  addField(dl, 'Mentions légales', (dd) => {
    const legal = card.legalText;
    if (!legal.present) {
      dd.textContent = 'Aucune page de mentions légales trouvée';
      dd.className = 'warning';
      return;
    }
    const p = document.createElement('p');
    p.style.margin = '0';
    p.textContent = `Présentes (langue détectée : ${legal.detectedLang === 'unknown' ? 'indéterminée' : legal.detectedLang})`;
    dd.appendChild(p);

    const ul = document.createElement('ul');
    if (legal.languageMismatch) {
      const li = document.createElement('li');
      li.textContent = 'Langue différente de celle déclarée par le site — possible mauvaise traduction.';
      li.className = 'warning';
      ul.appendChild(li);
    }
    if (legal.tooShort) {
      const li = document.createElement('li');
      li.textContent = 'Texte très court, peut-être un modèle générique non adapté.';
      li.className = 'warning';
      ul.appendChild(li);
    }
    if (ul.children.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Rien de particulier à signaler (vérification automatique sommaire, pas une relecture).';
      li.className = 'muted';
      ul.appendChild(li);
    }
    dd.appendChild(ul);
  });

  addField(dl, 'Mentions légales obligatoires', (dd) => {
    const mentions = card.mandatoryMentions;
    if (!mentions) {
      dd.textContent = 'Non vérifiables (pas de page de mentions légales trouvée).';
      dd.className = 'muted';
      return;
    }
    const ul = document.createElement('ul');
    for (const item of mentions.universal) {
      addChecklistItem(ul, item.label, item.present);
    }
    const sep = document.createElement('li');
    sep.textContent = 'Selon statut juridique :';
    sep.className = 'muted';
    sep.style.marginTop = '6px';
    ul.appendChild(sep);
    for (const item of mentions.conditional) {
      addChecklistItem(ul, item.label, item.present);
    }
    dd.appendChild(ul);
  });

  addField(dl, 'Vérification SIRET/SIREN', (dd) => {
    const check = card.companyCheck;
    if (!check?.candidate) {
      dd.textContent = 'Aucun numéro SIRET/SIREN trouvé sur la page.';
      dd.className = 'muted';
      return;
    }
    const ul = document.createElement('ul');
    const numberLi = document.createElement('li');
    numberLi.textContent = `Numéro trouvé : ${formatSiret(check.candidate)}`;
    ul.appendChild(numberLi);

    if (check.checksumValid === false) {
      const li = document.createElement('li');
      li.textContent = 'Format invalide (échec de la clé de contrôle) — numéro probablement mal formé ou fabriqué.';
      li.className = 'warning';
      ul.appendChild(li);
    } else if (check.registry && !check.registry.found) {
      const li = document.createElement('li');
      li.textContent = "N'existe pas au registre officiel des entreprises françaises.";
      li.className = 'warning';
      ul.appendChild(li);
    } else if (check.registry?.found) {
      const statusLi = document.createElement('li');
      statusLi.textContent = `Entreprise enregistrée : ${check.registry.name} (${check.registry.status === 'A' ? 'active' : 'cessée'})`;
      statusLi.className = check.registry.status === 'A' ? 'seo-ok' : 'warning';
      ul.appendChild(statusLi);
    }
    dd.appendChild(ul);
  });

  addField(dl, 'Optimisation SEO (balises meta)', (dd) => {
    const ul = document.createElement('ul');
    for (const item of card.seoMetaSummary) {
      addChecklistItem(ul, item.label, item.ok);
    }
    dd.appendChild(ul);
  });

  addField(dl, 'Popularité du site', (dd) => {
    dd.textContent = 'Non disponible (nécessite une source payante ou une clé API) — prévu pour une prochaine version.';
    dd.className = 'muted';
  });

  addField(dl, 'Liens référents (backlinks)', (dd) => {
    dd.textContent = 'Non disponible (nécessite une source payante ou une clé API) — prévu pour une prochaine version.';
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
    document.getElementById('identity-loading').textContent = card?.needsReload
      ? 'Rechargez la page pour afficher sa fiche.'
      : 'Fiche indisponible pour cette page.';
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
