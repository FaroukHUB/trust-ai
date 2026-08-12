# TRUST AI

Application interne de Trust Industrie pour centraliser les commandes
(Shopify et magasin), le suivi des fournisseurs, les relances du lundi, les
arrivages, les mouvements entre dépôts, les livraisons/retraits clients, les
règlements et les restes à payer (RAP), ainsi que la provenance marketing des
commandes.

> **Mode démonstration.** Cette première version est un prototype fonctionnel
> avec des données entièrement fictives, stockées dans le `localStorage` du
> navigateur. Aucune intégration réelle (Shopify, Supabase, OpenAI, WhatsApp)
> n'est branchée, aucun secret n'est stocké, et l'application **n'est pas
> prête pour la production** (pas d'authentification).

## Démarrer

```bash
npm install
npm run dev       # http://localhost:3000
npm run lint      # vérification ESLint
npm run test      # tests unitaires métier (vitest)
npm run build     # build de production (aucune variable d'environnement requise)
```

L'application se compile et fonctionne sur Vercel **sans aucune variable
d'environnement**. Le fichier `.env.example` liste les variables prévues pour
les phases suivantes (toutes vides).

## Pages

| Route | Rôle |
| --- | --- |
| `/dashboard` | Vue d'ensemble : commandes du jour, validations, relances, arrivages en retard, RAP, encaissements, alertes |
| `/commandes` | Liste des commandes (recherche, filtres, onglets Toutes / Shopify / Magasin) |
| `/commandes/nouvelle-magasin` | Formulaire complet de commande magasin (multi-articles, multi-règlements, RAP calculé) |
| `/commandes/[id]` | Fiche commande : suivi fournisseur par article, paiements, parcours logistique en timeline, acquisition, historique, validations |
| `/catalogue` | Catalogue centralisé des produits et variantes (SKU, prix, fournisseurs, synchronisation Shopify simulée) |
| `/validations` | File des demandes de validation humaine (Valider / Refuser, motif, impact financier) |
| `/achats` | Propositions de commandes fournisseurs regroupées par fournisseur, validation humaine obligatoire |
| `/relances` | File des relances fournisseurs du lundi, avec proposition de message |
| `/arrivages` | Transports et arrivages par dépôt et statut, réception partielle possible |
| `/fournisseurs` | Liste et fiches détaillées des fournisseurs |
| `/encaissements` | Récapitulatif par date, magasin, vendeuse/vendeur et moyen de paiement |
| `/acquisition` | Provenance marketing des commandes (sources, première page visitée, UTM) |

## Architecture

```
src/
  lib/
    types.ts              # Modèle de données complet (Store, Warehouse, Order,
                          # OrderLine, Supplier, ProductSupplier, SupplierOrder,
                          # Shipment, ShipmentLeg, Payment, AcquisitionJourney,
                          # ApprovalRequest, ActivityLog…)
    labels.ts             # Libellés français + tonalités de badges
    format.ts             # Dates françaises, euros, calcul du prochain lundi
    derive.ts             # Valeurs calculées : totaux, RAP, statut de paiement,
                          # file des relances (jamais stockées, toujours dérivées)
    seed.ts               # Données de démonstration fictives (10 scénarios)
    repository/           # Interface DataRepository + implémentation localStorage
    store/DataProvider.tsx# Contexte React : chargement hydratation-safe,
                          # actions métier, persistance via le repository
  components/
    layout/AppShell.tsx   # Barre latérale, menu mobile, en-tête, filtre magasin
    ui/                   # Badge, StatCard, EmptyState, LoadingState,
                          # ConfirmDialog, Toast
  app/                    # Pages (App Router)
```

Règles clés du prototype :

- **Aucun composant métier ne lit `localStorage` directement** : tout passe
  par `DataRepository` (versionné, avec **migration v1 → v2** qui conserve
  les commandes créées pendant la démo) via le `DataProvider`.
- Les **règles métier vivent dans `src/lib/mutations.ts`** (couche pure,
  testée par vitest) : un règlement doit être strictement positif, ne peut
  jamais dépasser le RAP, et une commande soldée n'accepte plus de
  règlement. Tous les calculs monétaires passent par des **centimes**
  (`src/lib/money.ts`).
- Le **RAP est toujours calculé** (`total − règlements`), jamais saisi. Le
  RAP global est la somme des RAP positifs **commande par commande** : un
  trop-perçu ne compense jamais le RAP d'une autre commande.
- Chaque **article d'une commande a son propre suivi** d'approvisionnement
  (fournisseur principal/alternatif, statut, arrivée prévue, dépôt, relances).
- Les **dépôts sont séparés des magasins** (Herblay est desservi par le dépôt
  d'Argenteuil sans que les deux entités soient fusionnées).
- Les **décisions importantes** (commande fournisseur, changement de
  fournisseur, annulation, affrètement…) passent par une **demande de
  validation humaine** ; aucune action extérieure réelle n'est exécutée.
- Un bouton dans la barre latérale **réinitialise les données de démo**.

## Architecture cible (phases suivantes)

1. **Shopify** enverra les nouvelles commandes automatiquement par **webhook**
   (`orders/create`, `orders/updated`) vers une route API, avec vérification
   de signature (`SHOPIFY_WEBHOOK_SECRET`).
2. **Supabase** stockera les données : un `SupabaseRepository` remplacera le
   `LocalStorageRepository` en implémentant la même interface
   `DataRepository`, sans réécrire l'interface utilisateur.
3. **OpenAI** proposera les fournisseurs alternatifs, les relances et les
   alertes (via `ProductSupplier` et l'historique d'activité).
4. **WhatsApp Business** pourra envoyer les messages fournisseurs **après
   validation humaine** (les propositions de messages existent déjà dans la
   page Relances).
5. Un **système d'authentification** (Supabase Auth) protégera l'application
   avant toute mise en production. Les types `UserProfile`, `Role` et
   `Permission` (`src/lib/types.ts`) sont prêts : à cette étape, **le choix
   manuel de la vendeuse/du vendeur dans les formulaires sera remplacé par
   l'utilisateur connecté** (nom et magasin renseignés automatiquement,
   droits selon le rôle, saisie « hors catalogue » réservée aux
   responsables). Cette connexion n'est pas un système de pointage : les
   horaires d'arrivée/départ seront une fonctionnalité distincte.

## Sécurité du prototype

- Données 100 % fictives (aucun nom, téléphone, adresse ou e-mail réel).
- `noindex, nofollow` dans les métadonnées + `robots.txt` bloquant
  l'indexation.
- Aucun secret stocké côté client ni dans le dépôt.
