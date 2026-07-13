# Libertium Pulse — Histoire du projet & guide de passation

> Ce document permet à une personne extérieure (successeur, prestataire, ou l'auteur dans 6 mois)
> de comprendre ce qui a été construit, pourquoi, et comment le reprendre.
> Dernière mise à jour : **13/07/2026**.

---

## 1. Le projet en bref

**Libertium Pulse** est le tableau de bord de la santé digitale du réseau Libertium :
**67 concessions** de camping-cars réparties en **7 business units** (L.EST, L.LOIRE, L.OUEST,
L.RENNES, L.STRASBOURG, L.SUD, L.SUD-OUEST).

Il agrège 4 sources en un **score de santé /100** par concession, par BU et pour le réseau,
avec code couleur strict : 🟢 ≥ 70 · 🟠 50–69 · 🔴 < 50.

| Source | Ce qu'on mesure | Particularité |
|---|---|---|
| Meta (Facebook + Instagram) | abonnés, portée, interactions, engagement | **Compte national uniquement** — visible en vision globale, hors score des BU |
| Google Analytics 4 | sessions du site par concession | pilier du score |
| Google Business Profile | note, avis (total + nouveaux), vues des fiches | pilier du score (note 70 % + nouveaux avis 30 %) |
| Leboncoin | annonces actives, vues, contacts | pilier du score (vues 50 % + contacts 50 %) — pas d'API, saisie CSV |

**Qui voit quoi** (règle absolue : l'adresse e-mail détermine l'accès, aucun choix de profil) :
- **Admin** : tout + gestion des accès + imports de données
- **Direction** : tout le réseau, y compris les comptes RS nationaux
- **Directeur de BU** : uniquement sa BU et ses concessions — le reste lui est refusé **par la base de données**, pas seulement par l'écran

**Emplacements** :
- Site : https://thelayns.github.io/libertium-pulse/
- Code : https://github.com/TheLayns/libertium-pulse (ce dépôt — pousser sur `main` = déployer)
- Base de données : projet Supabase `Libertium-Pulse` (compte Supabase de l'auteur, connexion GitHub)
- E-mails de connexion : compte Resend (connexion GitHub)
- Ancienne démo v1 : [`/v1/`](v1/) (page statique chiffrée par mot de passe)

---

## 2. Chronologie & décisions

### 06/07/2026 — v1 : la démo statique
- Point de départ : deux fichiers HTML existants (« Libertium Pulse », maquette de dashboard à
  données fictives, et « Carte Libertium France », carte Leaflet des 67 concessions).
- Construction d'un dashboard **mono-fichier** : les 67 vraies concessions extraites de la carte,
  la palette de marque reprise (rouge `#C12A21`, ardoise `#253746`, une couleur par BU),
  données fictives générées de façon **déterministe** (mêmes chiffres à chaque ouverture).
- Publication sur GitHub Pages. **Pourquoi chiffré (Staticrypt)** : GitHub Pages gratuit impose un
  dépôt public, or le fichier contenait les coordonnées réelles des responsables. La v1 chiffrée
  reste accessible sous `/v1/`.

### 07/07/2026 — v2 : le vrai produit
- **Constat** : la démo ne pouvait pas devenir un outil — rôles factices (tout le monde pouvait
  tout voir en lisant le code source), aucune persistance, import simulé.
- Réécriture en **modules ES sans build** (`js/`), et conception du backend **Supabase** :
  schéma Postgres, sécurité par lignes (RLS), fonction d'import transactionnelle.
- Nouveautés : **saisons Libertium** (septembre → août) avec comparaison à fenêtre égale,
  **Facebook et Instagram séparés**, compte national à part, **wizard d'import Excel/CSV réel**
  (détection de la source, rattachement des comptes aux concessions, mémorisation des alias),
  écran d'administration, carte cadrée sur la France.
- Un **mode démo** subsiste : si `SUPABASE_URL` est vide dans `js/config.js`, le site tourne sans
  backend avec données fictives et profils simulés (utile pour développer et faire des captures).

### 08/07/2026 — Démarches d'accès aux données réelles
- Recherche sur les APIs : **GA4 = facile** (compte de service), **GBP = possible** (formulaire
  d'accès à faire valider par Google, quota nul avant), **Meta = lourd** (App Review + vérification
  d'entreprise — mais simplifié car une seule page nationale), **Leboncoin = pas d'API** (modèle CSV fourni).
- Créé : projet Google Cloud `Libertium-Pulse`, compte de service
  `libertium-pulse@libertium-pulse.iam.gserviceaccount.com` + clé JSON (stockée localement).
- Demande envoyée à la gestionnaire du GA4 de libertium.fr (accès Éditeur + robot Lecteur +
  ID de propriété + comment distinguer les concessions).

### 13/07/2026 — v2.1 (audit de réalisme) puis mise en production
- **Audit** : vérification champ par champ que le dashboard n'affiche que des données réellement
  fournissables. Conclusion majeure : les concessions n'ont **pas** de compte RS propre → le pilier
  RS retiré du score des concessions/BU (score sur 3 piliers, renormalisé), tout le social regroupé
  dans un **bloc national enrichi** (vue Direction). Ajout des **vues de fiches Google** (info, hors score).
- **Mise en production** : projet Supabase créé, schéma exécuté, SMTP Resend configuré
  (e-mail en français avec **code à 6 chiffres de secours** — les scanners d'e-mails d'entreprise
  « consomment » les liens), 67 vraies concessions + 22 mois de données de démo injectés en base.
- **Tests de sécurité : 20/20** (voir §7).
- Corrections après premier test réel : **pagination du chargement** (l'API Supabase limite chaque
  requête à 1 000 lignes — sans pagination, seule L.EST s'affichait) ; **home directeur** réorganisée
  (liste des concessions sous le score, carte colorée par santé, trafic par concession).

---

## 3. Architecture

```
Navigateur (GitHub Pages, site 100 % statique)
   │  modules ES, aucun build — le code déployé est le code du dépôt
   │
   ├── supabase-js (CDN esm.sh) ──► Supabase (Postgres + Auth + API REST)
   │        connexion : lien magique e-mail + code OTP (PKCE)
   │        chaque requête passe par la RLS : la base filtre selon le rôle
   │
   └── Leaflet (CDN) + tuiles CARTO ──► carte de France
        (repli : carte SVG intégrée si hors ligne)
```

### Les fichiers qui comptent

| Fichier | Rôle |
|---|---|
| `js/config.js` | **Point de bascule** : URL + clé publique Supabase (vides = mode démo), palette, seuils et constantes du score, libellés des canaux |
| `js/metrics.js` | **Cœur métier** : calcul du score, agrégations concession→BU→réseau, mois/saisons, gestion des données manquantes, alertes |
| `js/api.js` | Toutes les lectures/écritures Supabase (ou magasin local en démo). Chargement **paginé** des métriques |
| `js/auth.js` | Connexion magic link + OTP, récupération du profil (e-mail → rôle) |
| `js/views.js` | Toutes les vues : login, dashboard, détail BU, fiche concession, bloc national, cartes |
| `js/admin.js` | Écran Administration (accès, journal, alias) + **wizard d'import** Excel/CSV |
| `js/app.js` | Assemblage : état global, routeur, événements, démarrage |
| `js/demo.js` + `js/demo-concessions.js` | Générateur de données fictives (mode démo **et** seed) — version publique sans coordonnées personnelles |
| `js/charts.js`, `js/map.js`, `js/period.js`, `js/state.js`, `js/util.js` | Graphiques SVG maison, carte Leaflet persistante, fenêtres temporelles, état, utilitaires |
| `supabase/schema.sql` | **Toute la base** : tables, règles de sécurité RLS, fonction d'import — à exécuter dans le SQL Editor d'un nouveau projet |
| `supabase/seed.mjs` | Injection des concessions + données de démo (local, avec la clé service) |
| `tests/` | `test-logique.mjs` (score, saisons), `test-import.mjs` (wizard), `test-rls.mjs` (sécurité contre la vraie base) |

### Modèle de données (table `metrics_monthly`)

Chaque ligne = **une cible × un canal × un mois** :
- `scope` + `target_id` : `concession` (id de concession), `bu` (code BU) ou `national`
- `channel` : `fb`, `ig`, `ga4`, `gmb`, `lbc`
- `month` (1er du mois) + `season` calculée automatiquement (saison 2025-26 = sept 2025 → août 2026)
- colonnes typées par canal (followers/reach/interactions, sessions, rating/avis/vues, annonces/vues/contacts)
- unicité `(scope, target_id, channel, month)` → ré-importer un mois **remplace** proprement

La table `account_aliases` fait le lien entre les noms trouvés dans les exports et les concessions,
**et** déclare l'existence des comptes (une concession sans alias `fb` n'a pas de page → son score
se calcule sans ce pilier). La table `access_list` est la liste e-mail → rôle, gérée dans l'écran Admin.

---

## 4. Décisions structurantes (le « pourquoi »)

| Décision | Raison |
|---|---|
| **Backend Supabase** plutôt que site statique seul | Un site statique ne peut rien cacher : la restriction « un directeur ne voit que sa BU » n'est réelle que si la base elle-même refuse (RLS). Supabase = Postgres géré + auth intégrée + gratuit à cette échelle |
| **Pas de framework, pas de build** | Un seul mainteneur non-développeur à terme : le code déployé est lisible tel quel, pousser sur `main` suffit à déployer, aucune chaîne d'outils à entretenir |
| **E-mail → rôle, sans choix de profil** | Exigence métier : impossible de « se déclarer » Direction. L'e-mail est vérifié par lien magique, le rôle vient de la base |
| **RS au national uniquement** | Réalité du terrain (audit du 13/07) : les concessions n'ont pas de page propre. Le mécanisme d'alias permet de rebrancher un compte local si un jour il en existe |
| **Import Excel avant les APIs** | Les accès API (Google, Meta) prennent des semaines de validation ; l'outil devait être utilisable et démontrable tout de suite |
| **Données de démo déterministes** | Démo reproductible (mêmes chiffres à chaque ouverture) et scénario pédagogique intégré (une BU rouge, des chutes visibles, un trou de données) |
| **Mode démo conservé dans le code** | Développer et tester les écrans sans toucher à la vraie base : servir le site avec `SUPABASE_URL` vide réactive les profils simulés et les liens de test `#role=…` |

---

## 5. Guide de reprise

### Comptes à récupérer
1. **GitHub `TheLayns`** — héberge le code et le site (Pages). Pousser sur `main` = déployer (~1 min)
2. **Supabase** (connexion GitHub) — projet `Libertium-Pulse` : base, utilisateurs, clés API
3. **Resend** (connexion GitHub) — envoi des e-mails de connexion (SMTP configuré dans Supabase)
4. **Google Cloud** projet `Libertium-Pulse` — compte de service pour la future synchro GA4 (clé JSON conservée localement par l'auteur, régénérable dans IAM → Comptes de service → Clés)

### Développer en local
```powershell
git clone https://github.com/TheLayns/libertium-pulse
npx serve libertium-pulse        # n'importe quel serveur statique (pas de file:// : modules ES)
```
Pour travailler sans toucher à la vraie base : vider `SUPABASE_URL` dans `js/config.js`
(NE PAS committer ce changement) → mode démo, liens de test `#role=direction`,
`#role=directeur_bu&bu=L.OUEST`, `#role=admin&view=admin`, `&saison=2025`.

### Tester
```powershell
node tests/test-logique.mjs      # moteur de score, saisons, données manquantes
node tests/test-import.mjs       # pipeline du wizard d'import
# sécurité contre la vraie base (nécessite les clés en variables d'environnement) :
$env:SUPABASE_URL="https://…supabase.co"; $env:SUPABASE_ANON_KEY="…"; $env:SUPABASE_SERVICE_KEY="…"
node tests/test-rls.mjs
```

### Opérations courantes
- **Ajouter/retirer un utilisateur** : se connecter en admin → Administration → Accès
- **Importer les données du mois** : Administration → Imports → Nouvel import (Excel/CSV,
  détection automatique ; modèle CSV Leboncoin téléchargeable au même endroit)
- **Recréer la base de zéro** : nouveau projet Supabase → coller `supabase/schema.sql` dans le
  SQL Editor → configurer Auth (URLs de redirection + SMTP, voir README §Mise en route) →
  `node supabase/seed.mjs` avec la clé service → mettre les clés dans `js/config.js`

---

### Surveiller le backend (5 minutes par mois)

| Quoi | Où | Signal d'alerte |
|---|---|---|
| Fraîcheur des données | Dashboard → Administration → Imports | pas d'import depuis > 1 mois |
| Envoi des e-mails de connexion | resend.com → Emails / Metrics | bounces, quota (100/jour · 3 000/mois gratuits) |
| Santé du projet Supabase | Supabase → Home + Settings → Usage | taille base (500 Mo gratuits — usage actuel < 2 %), requêtes, projet « paused » |
| Ping anti-pause | GitHub → Actions → workflow `keepalive` | runs en échec (rouge) |
| Liste des accès | Dashboard → Administration → Accès | un e-mail qui ne devrait plus y être (départ, changement de poste) |
| Sécurité après modification du schéma | `node tests/test-rls.mjs` | tout échec = ne pas déployer |

**Sauvegardes** : le plan gratuit Supabase n'inclut pas de sauvegarde automatique. Les fichiers
Excel importés SONT la sauvegarde des métriques (ré-importables via le wizard) ; le schéma est
dans `supabase/schema.sql` ; les concessions dans le seed. En cas de besoin d'une copie complète :
exporter les tables en CSV depuis le Table Editor de Supabase.

## 6. État au 13/07/2026 et suites

**Fait** : produit complet en production, sécurité validée, données de démonstration en base,
premier utilisateur connecté (rôle Direction).

**En cours / en attente de tiers** (détail dans [`TODO.md`](../TODO.md) du dossier parent) :
- GA4 : réponse de la gestionnaire (ID de propriété + ventilation par concession) → ensuite,
  développer la synchro automatique (fonction planifiée Supabase + compte de service)
- GBP : identifier le propriétaire du compte des 67 fiches → déposer la demande d'accès API
- Meta : accès au Business Manager de la page nationale
- Resend : vérifier un domaine (2-3 enregistrements DNS) pour livrer les e-mails de connexion
  à toutes les adresses (aujourd'hui limité à l'adresse du compte Resend)

**Backlog produit** (à prioriser avec la direction) : alertes par concession, export PDF/Excel,
objectifs par BU, top/flop du mois, notifications e-mail sur alerte rouge, annotations d'événements.

---

## 7. Pièges connus (ne pas les redécouvrir)

| Piège | Détail |
|---|---|
| **Limite 1 000 lignes de l'API Supabase** | Toute lecture de `metrics_monthly` doit être paginée (fait dans `api.js`) — sinon les données semblent « s'arrêter » à la première BU |
| **Carte qui montre toute l'Europe** | Leaflet : `fitBounds` doit être appelé **après** `invalidateSize()` (le conteneur n'a pas sa taille au premier rendu) — géré dans `map.js` |
| **E-mails de connexion qui n'arrivent pas** | ① Sans SMTP custom, Supabase limite à ~2 e-mails/heure ; ② Resend sans domaine vérifié ne livre qu'à l'adresse du compte ; ③ les scanners d'entreprise consomment les liens → toujours proposer le code OTP (déjà dans le template) |
| **Orthographe des BU** | La carte source écrit « L.SUD OUEST » (espace), tout le projet utilise « L.SUD-OUEST » (tiret) — normalisé à l'extraction |
| **Pause du projet Supabase gratuit** | ~7 jours sans requête → mise en pause (réveil en 1 clic, rien n'est perdu). Un usage régulier suffit ; sinon prévoir un ping hebdomadaire |
| **Sécurité** | La clé `anon` est **faite** pour être publique (la RLS protège). La clé `service_role` et la clé JSON Google ne doivent JAMAIS être commitées — après toute utilisation partagée, les régénérer |
| **Tests de sécurité** | Après tout changement du schéma ou des policies, relancer `tests/test-rls.mjs` — c'est lui qui prouve qu'un directeur ne voit pas les autres BU |
