# Changelog

Each version has an English and a French section. When a version is tagged,
the release workflow sends them to addons.mozilla.org as that version's
release notes (English as en-US, French as fr) and puts both in the GitHub
Release. A tag whose version has no section here, or no English section,
isn't released.

## 0.1.7

### English

- A domain registered less than a year ago is now enough on its own for an orange verdict; it used to take another warning sign once the domain was over six months old.
- The registrar Cloud Yuqu, seen on a fake furniture shop, now adds weight when the domain is also recent.
- A shop's "Terms of service" page ("Conditions d'utilisation") is now read like its terms of sale when looking for the company's details, so a shop with no legal notice is checked against it.
- Terms of sale titled "Conditions de vente" or "Termes et conditions", and a privacy link titled just "Privacy", are now found in the shop's footer.
- New warning sign: on a domain less than a year old, most struck-through prices on the page cut by half or more, like the designer furniture at -80 % of fake shops. A sale on an older shop doesn't count.
- When the page's prices are slashed like this, an orange "Be careful" banner says so on the shop, even if the verdict is only orange: once per site and tab. A red banner replaces it if the verdict turns red.
- Dropshipping alert: long delivery times alone, or split parcels alone, no longer mark a shop as likely dropshipping, even when it shows no French company number. Designer furniture often takes weeks to arrive; it now takes both, or a stronger clue such as a seller in Asia.
- Dropshipping alert: a delivery time the shop explains by making on order, made-to-measure work, an item out of stock and ordered from the maker, or a specialised furniture carrier is no longer taken as a clue.
- A shop established elsewhere in the EU, such as an Italian S.r.l., is no longer reported as missing its company form, address and SIRET: its own company form (S.r.l., GmbH, B.V.…), its address with the country's name and its VAT number are recognised.

### Français

- Un nom de domaine enregistré il y a moins d'un an suffit désormais à lui seul pour un avis orange ; au-delà de six mois, il fallait jusqu'ici un autre signe d'alerte.
- Le bureau d'enregistrement Cloud Yuqu, vu sur une fausse boutique de mobilier, compte désormais quand le domaine est aussi récent.
- La page « Conditions d'utilisation » d'une boutique est désormais lue comme ses CGV pour chercher l'identité de l'entreprise : une boutique sans mentions légales est vérifiée sur cette page.
- Les conditions de vente intitulées « Conditions de vente » ou « Termes et conditions », et un lien de confidentialité intitulé simplement « Privacy », sont désormais trouvés dans le pied de page de la boutique.
- Nouveau signe d'alerte : sur un domaine de moins d'un an, la plupart des prix barrés de la page réduits de moitié ou plus, comme le mobilier design à -80 % des fausses boutiques. Les soldes d'une boutique plus ancienne ne comptent pas.
- Quand les prix de la page sont cassés de cette façon, un bandeau orange « Soyez vigilant » l'indique sur la boutique, même si l'avis n'est qu'orange : une fois par site et par onglet. Le bandeau rouge le remplace si l'avis passe au rouge.
- Alerte dropshipping : des délais de livraison longs seuls, ou des colis séparés seuls, ne suffisent plus à signaler une boutique, même sans numéro d'entreprise français. Le mobilier design met souvent des semaines à arriver ; il faut désormais les deux, ou un indice plus fort comme un vendeur en Asie.
- Alerte dropshipping : un délai de livraison que la boutique explique par une fabrication sur commande, du sur-mesure, un article hors stock commandé au fabricant ou un transporteur spécialisé pour meubles n'est plus compté comme un indice.
- Une boutique établie ailleurs dans l'UE, comme une S.r.l. italienne, n'est plus signalée comme sans forme juridique, adresse ni SIRET : sa forme de société (S.r.l., GmbH, B.V.…), son adresse avec le nom du pays et son numéro de TVA sont reconnus.

## 0.1.6

### English

- Brand impersonation now also covers parcel delivery (La Poste, Colissimo, Chronopost, Mondial Relay, DHL, UPS, FedEx, Relais Colis) and government services (Ameli, impots.gouv, ANTS, CAF, Crit'Air, Mon Compte Formation, Service-Public.fr).
- A domain whose name is a common word one letter away from a brand, such as dart.fr (Darty) or point.fr (Point.P), is no longer reported as a look-alike.
- A domain that carries a brand's exact name under another extension, such as impots-gouv.fr or moncompteformation.fr, is now reported as a look-alike. The brands' own other domains (laposte.net, castorama.com…) are recognised.
- New setting, off by default: point out likely dropshipping shops. Dropshipping is not a scam, so it doesn't change the risk score: the popup lists the clues (a registered office shared by many dropshipping shops, a seller's address in Hong Kong or mainland China, the shop saying it ships from Asia, delivery times of several weeks, orders split across warehouses), the toolbar badge shows "DS" on a site that is otherwise fine, and a purple banner says so on the shop, once per site and tab. With the setting on, the shop's shipping policy is read too, or its FAQ when it has none.
- The "Details" button on the warning banner now opens GuardFou's usual analysis, as the toolbar button does, instead of a plain list of reasons.
- The settings button is now a gear at the top right of the popup instead of a link at the bottom.
- The settings are grouped into fewer sections (Checks, Trusted sites, Language, Data and sync), with a short explanation under each option.
- The trusted-sites list in the settings shows each site's domain again; the names were blank.

### Français

- La détection d'usurpation de marque couvre désormais la livraison (La Poste, Colissimo, Chronopost, Mondial Relay, DHL, UPS, FedEx, Relais Colis) et les services publics (Ameli, impots.gouv, ANTS, CAF, Crit'Air, Mon Compte Formation, Service-Public.fr).
- Un domaine dont le nom est un mot courant, à une lettre près du nom d'une marque, comme dart.fr (Darty) ou point.fr (Point.P), n'est plus signalé comme imitation.
- Un domaine qui reprend le nom exact d'une marque avec une autre extension, comme impots-gouv.fr ou moncompteformation.fr, est désormais signalé comme imitation. Les autres domaines des marques elles-mêmes (laposte.net, castorama.com…) sont reconnus.
- Nouveau réglage, désactivé par défaut : signaler les boutiques probablement en dropshipping. Le dropshipping n'est pas une arnaque, donc le score de risque ne change pas : le popup liste les indices (une adresse de domiciliation partagée par de nombreuses boutiques en dropshipping, un vendeur domicilié à Hong Kong ou en Chine continentale, une boutique qui dit expédier depuis l'Asie, des délais de livraison de plusieurs semaines, des commandes réparties entre plusieurs entrepôts), le badge de la barre d'outils affiche « DS » sur un site par ailleurs sans risque, et un bandeau violet l'indique sur la boutique, une fois par site et par onglet. Avec ce réglage, la politique de livraison de la boutique est lue aussi, ou sa FAQ si elle n'en a pas.
- Le bouton « Détails » du bandeau d'alerte ouvre désormais l'analyse habituelle de GuardFou, comme le bouton de la barre d'outils, au lieu d'une simple liste des raisons.
- Le bouton des réglages est désormais un engrenage en haut à droite de la fenêtre GuardFou, au lieu d'un lien tout en bas.
- Les réglages sont regroupés en moins de sections (Vérifications, Sites de confiance, Langue, Données et synchronisation), avec une courte explication sous chaque option.
- La liste des sites de confiance dans les réglages affiche de nouveau le domaine de chaque site ; les noms étaient vides.

## 0.1.5

### English

- The trusted-sites list is back in the settings, and now syncs with your other settings. If you had one before 0.1.4, please add your sites again.
- The watched-registrars setting has been removed; GuardFou keeps using its built-in list.
- The legal-notice line in the popup is shorter and fits on one line.
- The popup shows that the page is being analyzed instead of staying blank, and waits for the result when the analysis is still running.
- When a site's bot protection (such as Cloudflare) blocks the legal-page check, the page you're on now reads them from its own site instead. If that fails too, they are reported as unreadable, without raising the score, instead of as missing, and the site is not asked again for a day.
- Legal links that are not real links (plain text opened by JavaScript, as on many Next.js sites) are now found through the addresses the page itself embeds.
- The company behind a site is recognised in more legal-notice wordings ("propriété de", "publié par", the name written before the SIRET or RCS), so a site run by a company with another name, such as LesFurets by La Centrale de Financement, is no longer suspected of reusing a SIRET.
- When a legal notice gives the hosting provider's SIRET before the publisher's, the publisher's is now checked: the host's no longer triggers a false "reused SIRET" warning.
- A page that declares its own site name is no longer taken for a brand mentioned in its title: a comparison site's guide about EDF is no longer flagged as impersonating EDF.
- In the identity card, the other sites on the same server are now links.
- The identity card recognises more technologies: site builders, including AI ones (Lovable, Framer, Webflow, Hostinger, GoDaddy, Jimdo, Duda, Square Online), Odoo, and the Next.js, Nuxt and Vite frameworks.
- A new domain whose pages ask search engines not to list them now adds to the score.
- Brand impersonation now covers windshield repair (Carglass, France Pare-Brise, Mondial Pare-Brise), energy (EDF, Engie, TotalEnergies) and insurance (AXA, Allianz, Groupama, MAIF, Macif, MAAF, Matmut, GMF).
- Look-alike domain checks no longer apply to Boulanger's name, which is also a common French word: a site such as boulanger-direct.fr is no longer flagged. A page that names itself Boulanger is still checked.

### Français

- La liste des sites de confiance est de retour dans les paramètres, et se synchronise désormais avec vos autres réglages. Si vous en aviez une avant la 0.1.4, ajoutez de nouveau vos sites.
- Le réglage des bureaux d'enregistrement surveillés a été supprimé ; GuardFou continue d'utiliser sa liste intégrée.
- La ligne des mentions légales du popup est plus courte et tient sur une seule ligne.
- Le popup indique que la page est en cours d'analyse au lieu de rester vide, et attend le résultat si l'analyse n'est pas terminée.
- Quand la protection anti-robots d'un site (comme Cloudflare) bloque la vérification des pages légales, c'est désormais la page ouverte qui les lit depuis son propre site. Si cela échoue aussi, elles sont signalées comme illisibles, sans augmenter le score, au lieu d'être déclarées absentes, et le site n'est pas sollicité de nouveau avant le lendemain.
- Les liens légaux qui ne sont pas de vrais liens (du texte ouvert par JavaScript, comme sur de nombreux sites Next.js) sont désormais retrouvés grâce aux adresses que la page contient elle-même.
- La société derrière un site est reconnue dans plus de formulations des mentions légales (« propriété de », « publié par », le nom écrit avant le SIRET ou le RCS) : un site exploité par une société d'un autre nom, comme LesFurets par La Centrale de Financement, n'est plus soupçonné de réutiliser un SIRET.
- Quand des mentions légales donnent le SIRET de l'hébergeur avant celui de l'éditeur, c'est désormais celui de l'éditeur qui est vérifié : celui de l'hébergeur ne déclenche plus une fausse alerte de « SIRET réutilisé ».
- Une page qui déclare son propre nom de site n'est plus prise pour une marque citée dans son titre : le guide d'un comparateur sur EDF n'est plus signalé comme usurpant EDF.
- Dans la fiche d'identité, les autres sites du même serveur sont désormais des liens.
- La fiche d'identité reconnaît plus de technologies : les créateurs de sites, y compris par IA (Lovable, Framer, Webflow, Hostinger, GoDaddy, Jimdo, Duda, Square Online), Odoo, et les frameworks Next.js, Nuxt et Vite.
- Un domaine récent dont les pages demandent à ne pas être référencées par les moteurs de recherche augmente désormais le score.
- La détection d'usurpation de marque couvre désormais le remplacement de pare-brise (Carglass, France Pare-Brise, Mondial Pare-Brise), l'énergie (EDF, Engie, TotalEnergies) et l'assurance (AXA, Allianz, Groupama, MAIF, Macif, MAAF, Matmut, GMF).
- La détection des domaines qui imitent Boulanger ne vise plus les variantes proches du nom, car « boulanger » est aussi un mot courant : un site comme boulanger-direct.fr n'est plus signalé. Une page qui se présente comme Boulanger reste contrôlée.

## 0.1.4

### English

- Settings now sync across your devices through Chrome Sync or Firefox Sync when extension syncing is enabled. Existing settings are carried over; lookup results stay on each device.
- New option to ignore the raw-IP and unencrypted-HTTP warnings on private IP addresses (local services, development servers).
- The trusted-sites list has been removed: every site is now checked.
- The settings page no longer shows internal names in place of a missing translation.

### Français

- Les paramètres se synchronisent désormais entre vos appareils via Chrome Sync ou Firefox Sync lorsque la synchronisation des extensions est activée. Les réglages existants sont conservés ; les résultats des recherches restent sur chaque appareil.
- Nouvelle option pour ignorer les alertes d'adresse IP brute et de connexion HTTP non chiffrée sur les adresses IP privées (services locaux, serveurs de développement).
- La liste des sites de confiance a été supprimée : tous les sites sont désormais vérifiés.
- La page des paramètres n'affiche plus d'identifiants techniques à la place d'une traduction manquante.

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
