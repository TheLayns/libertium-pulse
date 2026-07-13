# Démarches externes — textes et procédures prêts à l'emploi

Tout ce qu'il faut copier-coller pour les démarches en cours. Voir aussi `TODO.md` (dossier parent) et [HISTORIQUE.md](../HISTORIQUE.md).

---

## 1. Google Business Profile — demande d'accès API

**Avant de déposer, il faut :**
- savoir **quel compte Google possède les 67 fiches** (idéalement un « groupe d'établissements ») — la demande doit partir de ce compte ;
- le **numéro de projet Google Cloud** : projet `Libertium-Pulse` → Console Google Cloud → tableau de bord → « Numéro du projet » (Project number, une suite de chiffres).

**Où** : https://support.google.com/business/workflow/16726127 (formulaire « Application for Basic API Access »), connecté avec le compte propriétaire des fiches.

**Réponses à coller** (le formulaire est en anglais) :

> **Business name:** Libertium (recreational vehicle dealership network, France)
> **Website:** https://libertium.fr
> **Use case description:**
> We operate a network of 67 RV dealerships in France under the Libertium brand. All locations are managed under our own Google Business Profile account. We are building an internal reporting dashboard for our management team and would like to use the Business Profile APIs (Business Information, Business Profile Performance, and Reviews) to automatically retrieve, once a day, the performance metrics of our own locations: average rating, review counts, and profile impressions. Data is used exclusively for internal reporting; we do not manage profiles on behalf of third parties, and we do not write or modify any data through the API.
> **Number of locations:** 67 (all owned and operated by our company)
> **Expected API usage:** ~70–150 read-only requests per day

Après approbation (quelques jours à quelques semaines) : quota accordé au projet Google Cloud → me le dire, je code la synchro.

---

## 2. Meta — accès au Business Manager de la page nationale

**Objectif** : être ajouté au Business Manager qui détient la page Facebook « Libertium France » et le compte Instagram associé, pour brancher à terme la lecture automatique des statistiques.

**Message à envoyer à la personne qui administre la page :**

> Bonjour,
>
> Dans le cadre du tableau de bord de pilotage digital Libertium, j'ai besoin de récupérer les statistiques de la page Facebook « Libertium France » et du compte Instagram associé (abonnés, portée, interactions).
>
> Peux-tu :
> 1. Me confirmer que la page et le compte Instagram sont bien rattachés à un **Business Manager** (business.facebook.com) — et si non, les y rattacher ;
> 2. **M'ajouter comme personne** dans ce Business Manager (Paramètres → Personnes) avec l'accès à la page et au compte Instagram — un accès « Analyser » / lecture des statistiques me suffit ;
> 3. Me dire si une **vérification d'entreprise** (Business Verification, dans le Centre de sécurité) a déjà été faite.
>
> C'est uniquement de la lecture de statistiques pour le reporting interne — aucune publication ni modification. Si tu as des questions, appelle-moi.
>
> Merci !

**Bon à savoir** : comme il n'y a qu'une seule page (nationale), l'intégration API est beaucoup plus légère que prévu — en attendant, l'export mensuel Meta Business Suite s'importe déjà dans le dashboard (Administration → Imports).

---

## 3. Resend — vérifier un domaine (envoi des e-mails de connexion à tout le monde)

**Pourquoi** : sans domaine vérifié, Resend n'envoie les liens de connexion **qu'à l'adresse du compte Resend**. Avec un domaine vérifié (ex. `libertium.fr` ou un sous-domaine `pulse.libertium.fr`), on peut envoyer à toutes les adresses (chef, directeurs, Trigano…).

**Étape A — toi (5 min)** : https://resend.com → **Domains → Add Domain** → saisis le domaine convenu (demande d'abord au gestionnaire lequel utiliser). Resend affiche alors **la liste exacte des enregistrements DNS** à créer (généralement : 1 enregistrement MX + 2-3 enregistrements TXT pour SPF et DKIM). Fais une capture d'écran de cette liste.

**Étape B — message au gestionnaire du domaine** (avec ta capture) :

> Bonjour,
>
> Pour l'envoi des e-mails de connexion de notre tableau de bord interne Libertium Pulse, peux-tu ajouter les enregistrements DNS ci-joints sur le domaine (capture d'écran) ? Il s'agit d'enregistrements standards d'authentification d'e-mail (SPF/DKIM + un MX de retour) fournis par notre service d'envoi (Resend). Ils n'affectent ni le site ni la messagerie existante.
>
> Merci !

**Étape C — après ajout des DNS** : Resend → Domains → « Verify » (peut prendre quelques minutes à quelques heures) → puis dans Supabase → Authentication → SMTP Settings, remplacer le Sender email `onboarding@resend.dev` par une adresse du domaine vérifié (ex. `pulse@libertium.fr`).

---

## 4. GA4 — mail à Émilie (pour mémoire, déjà rédigé)

> Bonjour Émilie,
>
> Dans le cadre du tableau de bord de pilotage digital Libertium que je suis en train de créer, j'ai besoin de récupérer automatiquement les statistiques du site via l'API Google Analytics. Peux-tu :
>
> 1. M'ajouter à la propriété GA4 de libertium.fr en **Éditeur** : laywens.feriaux@gmail.com
> 2. Ajouter également ce compte en **Lecteur** : libertium-pulse@libertium-pulse.iam.gserviceaccount.com — c'est un robot de lecture seule qui récupère les statistiques pour le tableau de bord, il ne peut rien modifier dans la configuration.
> 3. Me communiquer l'**ID de propriété** (Admin → Paramètres de la propriété) pour que je configure tout correctement.
> 4. Dernière question : sait-on **distinguer le trafic par concession** dans GA4 ? Par exemple une dimension personnalisée (« concession », « point de vente »…) ou des URLs du type libertium.fr/concessions/nom-de-la-concession/ ?
>
> Il me faut ça pour réaliser mes tests et valider que le tableau de bord peut fonctionner. Si tu as des questions, n'hésite pas à m'appeler.
>
> Cordialement,
> Laywens FERIAUX
