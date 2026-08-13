# Connecter Shopify à TRUST AI — guide pas à pas

Ce guide active la réception automatique des commandes Shopify et la
synchronisation du catalogue. Prérequis : le mode connecté Supabase
fonctionne (voir `docs/SUPABASE_SETUP.md`).

> **Règle d'or** : les valeurs manipulées ici sont des SECRETS SERVEUR.
> Elles se collent uniquement dans les variables d'environnement Vercel
> (sans préfixe `NEXT_PUBLIC_`). Jamais dans le code, jamais dans une
> conversation, jamais dans un fichier committé.

## Ce que fait l'intégration

* **Commandes** : chaque commande Shopify (création puis mises à jour)
  arrive automatiquement dans TRUST AI via webhook — client, articles,
  montants, paiement en ligne (règlement « Shopify (en ligne) »), première
  page visitée et paramètres UTM (source *mesurée*).
* **Catalogue** : les produits Shopify arrivent par webhook au fil de l'eau,
  et un bouton « Synchroniser depuis Shopify » (page Catalogue, rôles
  achats/direction/admin) importe tout le catalogue d'un coup.
* **Idempotence** : rejouer un webhook ne crée jamais de doublon, et une
  mise à jour Shopify n'écrase JAMAIS le suivi d'approvisionnement saisi
  par l'équipe (statuts, fournisseurs, dépôts).
* Chaque webhook reçu est journalisé dans la table
  `shopify_webhook_events` (visible des administrateurs) pour le débogage.

## 1. Appliquer la migration 4

Si ce n'est pas déjà fait, exécute
`supabase/migrations/20260813000400_shopify_integration.sql` sur la base
(SQL Editor, comme les migrations précédentes, ou `supabase db push`).

## 2. Récupérer la clé secrète Supabase

Dashboard **Supabase** → Settings → **API Keys** → section **Secret keys**
→ copie la clé (commence par `sb_secret_`). C'est elle qui permet aux
routes serveur d'écrire les commandes reçues.

Dans **Vercel** → Environment Variables, ajoute (Production **et** Preview) :

| Key | Value |
| --- | --- |
| `SUPABASE_SECRET_KEY` | la clé `sb_secret_…` |

## 3. Créer une application personnalisée dans Shopify

1. Admin Shopify → **Paramètres** (en bas à gauche) → **Applications et
   canaux de vente** → **Développer des applications** ;
   * si c'est la première fois : bouton **Autoriser le développement
     d'applications personnalisées** ;
2. **Créer une application** → nom : `TRUST AI` ;
3. Onglet **Configuration** → **Admin API integration** → **Configurer** ;
4. Coche uniquement les périmètres (scopes) :
   * `read_products`
   * `read_orders`
5. **Enregistrer**, puis onglet **Identifiants API** → **Installer
   l'application** ;
6. Révèle le **jeton d'accès à l'API Admin** (commence par `shpat_`) —
   ⚠️ il ne s'affiche qu'UNE fois : copie-le immédiatement dans Vercel :

| Key | Value |
| --- | --- |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | le jeton `shpat_…` |
| `SHOPIFY_STORE_DOMAIN` | le domaine technique, ex. `ma-boutique.myshopify.com` |

(Le domaine technique est visible dans Paramètres → Domaines, ou dans
l'URL de ton admin : `admin.shopify.com/store/ma-boutique`
→ `ma-boutique.myshopify.com`.)

## 4. Créer les webhooks

1. Admin Shopify → **Paramètres** → **Notifications** → **Webhooks**
   (tout en bas) ;
2. Crée **4 webhooks**, tous au format **JSON**, tous vers la même URL :

```
https://trust-industrie-ai.vercel.app/api/webhooks/shopify
```

   * Événement **Création de commande** (orders/create)
   * Événement **Mise à jour de commande** (orders/updated)
   * Événement **Création de produit** (products/create)
   * Événement **Mise à jour de produit** (products/update)

3. Sous la liste des webhooks, Shopify affiche une phrase du type
   « Tous vos webhooks seront signés avec … » suivie d'une clé : c'est le
   **secret de signature**. Copie-le dans Vercel :

| Key | Value |
| --- | --- |
| `SHOPIFY_WEBHOOK_SECRET` | la clé de signature affichée |

## 5. Redéployer et tester

1. Vercel → Deployments → **Redeploy** (les nouvelles variables ne
   s'appliquent qu'aux nouveaux builds) ;
2. Dans Shopify → Notifications → Webhooks → bouton **Envoyer un
   webhook de test** sur « Création de commande » → il doit être accepté
   (HTTP 200) ;
3. Page **Catalogue** de TRUST AI → bouton **« Synchroniser depuis
   Shopify »** → le catalogue réel s'importe (produits marqués
   « Shopify » avec date de synchronisation) ;
4. Passe une commande de test dans Shopify : elle doit apparaître dans
   TRUST AI (onglet Shopify de la page Commandes) avec son règlement en
   ligne et sa source d'acquisition mesurée.

## Dépannage

* **Webhook refusé (401)** : le `SHOPIFY_WEBHOOK_SECRET` ne correspond pas —
  recopie la clé de signature affichée sous la liste des webhooks (ce n'est
  PAS le token `shpat_`), puis redéploie.
* **Webhook refusé (503)** : une variable manque (`SHOPIFY_WEBHOOK_SECRET`
  ou `SUPABASE_SECRET_KEY`) — vérifie l'orthographe exacte dans Vercel et
  redéploie.
* **Erreur 500 répétée** : consulte la table `shopify_webhook_events`
  (SQL Editor : `select topic, status, error, received_at from
  shopify_webhook_events order by received_at desc limit 20;`) — la
  colonne `error` explique le problème. Shopify retente automatiquement
  les livraisons échouées pendant 48 h.
* **Synchronisation catalogue en erreur 502** : le token `shpat_` est
  invalide ou les scopes `read_products` manquent — vérifie l'étape 3.
* **Retour arrière** : supprime les 4 webhooks dans Shopify ; l'application
  continue de fonctionner normalement sans eux.

## Limites volontaires de cette phase

* Shopify est en LECTURE seule (aucune écriture vers Shopify) ;
* les remboursements Shopify ne sont pas encore traités (phase
  remboursements/avoirs) ;
* WhatsApp et OpenAI restent non connectés.
