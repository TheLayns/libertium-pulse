# Libertium Pulse v2

Tableau de bord de la santé digitale du réseau Libertium — 67 concessions, 7 business units.
Sources : Meta (Facebook + Instagram séparés) · Google Analytics 4 · Google Business Profile · Leboncoin.

🔗 **https://thelayns.github.io/libertium-pulse/**

- Sans backend configuré, le site tourne en **mode démo** (données fictives, profils simulés).
- Avec Supabase configuré : **connexion par e-mail (lien magique + code)**, l'adresse détermine
  automatiquement l'accès (Direction = tout le réseau, Directeur = sa BU uniquement), les admins
  gèrent les accès et importent les données (Excel/CSV) depuis l'écran Administration.
- L'ancienne version (v1, démo statique chiffrée) reste accessible sous [`/v1/`](v1/).

## Structure

```
index.html            coquille
css/                  styles + police Archivo embarquée
js/                   application (modules ES, sans build)
supabase/schema.sql   schéma complet : tables, sécurité RLS, RPC d'import
supabase/seed.mjs     données de démonstration -> base (local uniquement)
```

## Mise en route du backend (une fois, ~15 min)

1. **Créer le projet** : https://supabase.com → New project (région EU, plan Free).
2. **Schéma** : dashboard Supabase → SQL Editor → coller le contenu de `supabase/schema.sql`
   → **remplacer l'e-mail admin en bas du fichier par le vôtre** → Run.
3. **Auth** : Authentication → URL Configuration →
   - Site URL : `https://thelayns.github.io/libertium-pulse/`
   - Redirect URLs : ajouter la même valeur (+ `http://localhost:8080/` pour le dev).
4. **SMTP custom (obligatoire)** : le SMTP intégré est limité à ~2 e-mails/heure.
   Créer un compte gratuit [Resend](https://resend.com) (3 000 mails/mois) ou Brevo →
   Authentication → SMTP Settings → renseigner hôte/port/identifiants.
   Dans le template « Magic Link », garder le lien **et** afficher `{{ .Token }}`
   (code à 6 chiffres de secours — certains antivirus d'entreprise consomment les liens).
5. **Clés** : Settings → API → copier `Project URL` et `anon public key` dans
   `js/config.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) → commit + push.
6. **Seed de démonstration** (optionnel mais recommandé pour la première démo) :
   ```powershell
   $env:SUPABASE_URL = "https://xxxx.supabase.co"
   $env:SUPABASE_SERVICE_KEY = "<service_role key>"   # Settings -> API (à ne jamais publier)
   node supabase/seed.mjs
   ```
7. Ouvrir le site → saisir votre e-mail → lien/code reçu → vous êtes admin.
   Écran **Administration** : ajouter votre chef (Direction ou Admin), les directeurs (Directeur BU + leur BU).

## Import des données

Administration → Imports → **Nouvel import** : déposez l'export brut (`.xlsx`/`.csv`).
La source et les colonnes sont détectées automatiquement, les comptes sont rapprochés des
concessions (les rapprochements confirmés sont mémorisés), le mois est détecté ou choisi,
puis l'import est journalisé. Ré-importer un même mois remplace proprement les données.

Pour Leboncoin (pas d'API ni d'export standard) : bouton « Modèle CSV Leboncoin ».

## Développement local

```powershell
npx serve .   # ou tout autre serveur statique — les modules ES ne marchent pas en file://
```
Mode démo : deep-links de test `#role=direction`, `#role=directeur_bu&bu=L.OUEST`, `#role=admin&view=admin`, `#saison=2025`.
