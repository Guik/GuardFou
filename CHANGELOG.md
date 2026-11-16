# Changelog

Each version has an English and a French section. When a version is tagged,
the release workflow sends them to addons.mozilla.org as that version's
release notes (English as en-US, French as fr) and puts both in the GitHub
Release. A tag whose version has no section here, or no English section,
isn't released.

## 0.1.3

### English

- The popup now summarizes domain dates, company details and legal-notice checks. The identity card adds a timeline comparing the company's creation date with the domain's registration date.
- The identity card now shows the site's hosting provider and IP address, and lists other sites found on the same server.
- Hosting lookups now use the hostname you visited, so `www` and the bare domain can show different providers correctly.
- Long details now wrap within the popup, and the compact domain summary no longer includes the registrar name.

### Français

- Le popup résume désormais les dates du domaine, les informations sur l'entreprise et les vérifications des mentions légales. La fiche d'identité ajoute une chronologie qui compare la création de l'entreprise à l'enregistrement du domaine.
- La fiche d'identité indique désormais le fournisseur d'hébergement et l'adresse IP du site, et liste les autres sites détectés sur le même serveur.
- La recherche d'hébergement utilise maintenant le nom d'hôte consulté : `www` et le domaine nu peuvent ainsi afficher des fournisseurs différents.
- Les informations longues tiennent désormais dans le popup, et le nom du registrar a été retiré du résumé compact du domaine.

## 0.1.2

### English

- The interface is available in English and French. It follows Firefox's language, and the settings let you pick one.
- Legal notice pages linked through a script instead of a regular link are now found, so these sites no longer get a false "no legal notice" warning.
- A company number belonging to the company that the legal notice names as publisher (a site trading under another brand) is no longer reported as someone else's number.
- New icon.

### Français

- L'interface est disponible en anglais et en français. Elle suit la langue de Firefox, et les réglages permettent d'en choisir une.
- Les pages de mentions légales ouvertes par un script plutôt que par un lien classique sont désormais trouvées : ces sites n'ont plus de fausse alerte « aucune mention légale ».
- Un numéro d'entreprise appartenant à la société que les mentions légales désignent comme éditeur (un site exploité sous une autre enseigne) n'est plus signalé comme le numéro d'une autre entreprise.
- Nouvelle icône.

## 0.1.0

### English

- First release.

### Français

- Première version.
