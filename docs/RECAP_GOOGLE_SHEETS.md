# Brancher le récapitulatif Google Sheets sur TRUST AI

Ce guide se fait **entièrement dans le navigateur**. Aucun terminal, aucune
installation, aucune ligne de commande.

À la fin :

- TRUST AI **lit** le fichier récapitulatif, en **lecture seule** ;
- chaque ligne du fichier devient une ligne suivie dans TRUST AI (arrivées,
  transfert Argenteuil → Aubagne, disponibilité) ;
- **rien ne change pour les vendeuses** : elles continuent à remplir le
  fichier exactement comme aujourd'hui.

---

## Ce que TRUST AI fait — et ne fait pas

| TRUST AI | |
|---|---|
| Lit le fichier | ✅ oui, en lecture seule |
| Écrit dans le fichier | ❌ **jamais** — l'autorisation Google demandée ne le permet pas |
| Supprime une ligne | ❌ jamais. Une ligne qui disparaît du fichier est **signalée**, pas effacée |
| Devine une destination | ❌ jamais. Une destination non reconnue crée une **anomalie** à trancher par un humain |
| Demande un export quotidien aux vendeuses | ❌ jamais |

La seule chose écrite dans le Google Sheets l'est par un **petit script installé
dans le fichier lui-même** (étape 3), et uniquement dans une colonne technique
`ID TRUST`. TRUST AI n'y touche pas.

---

## Vue d'ensemble : 5 étapes

1. Créer un « compte de service » Google (l'identité que TRUST AI utilise pour lire).
2. Partager le Google Sheets **en lecteur** avec ce compte de service.
3. Installer le script `ID TRUST` dans le Google Sheets.
4. Renseigner les deux variables dans Vercel.
5. Configurer la source dans TRUST AI et prévisualiser.

Comptez 20 à 30 minutes la première fois.

---

## Étape 1 — Créer le compte de service Google

Un **compte de service**, c'est une adresse e-mail robot. On lui donne accès au
fichier comme à un collègue, sauf qu'elle appartient à l'application.

1. Aller sur <https://console.cloud.google.com/>.
2. En haut à gauche, ouvrir le sélecteur de projet → **Nouveau projet**.
   Nom : `TRUST AI`. → **Créer**. Attendre quelques secondes, puis
   **sélectionner** ce projet.
3. Dans la barre de recherche du haut, taper `Google Sheets API` →
   ouvrir le résultat → bouton **Activer**.
4. Barre de recherche → `Comptes de service` (ou *Service accounts*) →
   **Créer un compte de service**.
   - Nom : `trust-ai-lecture-recap`
   - **Créer et continuer** → l'étape « Accorder un rôle » n'est **pas**
     nécessaire : cliquer **Continuer**, puis **OK**.
5. La liste affiche maintenant une adresse du type
   `trust-ai-lecture-recap@trust-ai-123456.iam.gserviceaccount.com`.
   **Copiez-la et gardez-la de côté** : c'est `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
6. Cliquer sur le compte de service → onglet **Clés** → **Ajouter une clé** →
   **Créer une clé** → type **JSON** → **Créer**.
   Un fichier `.json` se télécharge.

> ⚠️ **Ce fichier JSON est un mot de passe.** Ne l'envoyez à personne, ne le
> collez dans aucune conversation (y compris avec Claude), ne le déposez pas
> dans le dépôt GitHub. Il servira une seule fois, à l'étape 4, puis pourra
> être supprimé de votre ordinateur.

---

## Étape 2 — Partager le fichier avec ce compte

1. Ouvrir le Google Sheets du récapitulatif.
2. Bouton **Partager** (en haut à droite).
3. Coller l'adresse du compte de service (celle de l'étape 1.5).
4. Choisir le rôle **Lecteur** — surtout pas Éditeur.
5. Décocher « Envoyer une notification » si l'option apparaît, puis **Partager**.

Google peut afficher un avertissement « cette adresse n'est pas un compte
Google habituel » : c'est normal, continuez.

Notez aussi, dans la barre d'adresse, l'**identifiant du fichier** — la longue
suite de caractères entre `/d/` et `/edit` :

```
https://docs.google.com/spreadsheets/d/1AbCdEf...XyZ/edit#gid=0
                                        ^^^^^^^^^^^^^^
                                        c'est ça
```

---

## Étape 3 — Installer le script « ID TRUST » dans le Sheets

Ce script donne à chaque ligne un identifiant stable. Sans lui, TRUST AI
reconnaît quand même les lignes (par empreinte), mais une ligne modifiée en
profondeur peut être vue comme nouvelle. **Avec** lui, une ligne reste la même
même si elle est déplacée, triée ou corrigée.

1. Dans le Google Sheets, ajouter une colonne dont le titre est exactement
   `ID TRUST` (à la fin du tableau, c'est parfait). Laisser les cellules vides.
2. Menu **Extensions** → **Apps Script**.
3. Effacer le contenu de `Code.gs`, puis coller **tout** le contenu du fichier
   [`google-apps-script/id-trust.gs`](../google-apps-script/id-trust.gs) de ce
   dépôt.
4. En haut du script, vérifier les trois réglages :
   - `TRUST_SHEET_NAME` : le nom exact de l'onglet (`RECAP` par défaut) ;
   - `TRUST_ID_HEADER` : `ID TRUST` ;
   - `TRUST_HEADER_ROW` : le numéro de la ligne des titres (1 par défaut).
5. Icône **Enregistrer** (disquette).
6. Choisir la fonction `remplirIdentifiantsTrust` dans la liste déroulante,
   puis **Exécuter**. Google demande une autorisation : **Autoriser**
   (« Avancé » → « Accéder à … » si l'écran d'avertissement apparaît).
   Les identifiants se remplissent.
7. **Déclencheur automatique** : icône **⏰ Déclencheurs** (colonne de gauche) →
   **Ajouter un déclencheur** :
   - Fonction : `onChangeTrustIds`
   - Source de l'événement : **Depuis la feuille de calcul**
   - Type d'événement : **En cas de modification** (*on change*)
   - **Enregistrer**.

Désormais, toute ligne ajoutée reçoit son identifiant toute seule. Un menu
**TRUST AI** apparaît aussi dans la barre du Sheets (après rechargement) pour
lancer le remplissage à la main ou vérifier les doublons.

> Le script n'envoie rien à l'extérieur et n'écrit **que** dans la colonne
> `ID TRUST`. Un copier-coller de ligne crée un doublon d'identifiant : le
> script régénère alors **uniquement la copie**, l'originale garde son
> historique.

---

## Étape 4 — Les deux variables dans Vercel

1. Ouvrir <https://vercel.com/> → projet **trust-ai** → **Settings** →
   **Environment Variables**.
2. Ajouter :

   | Name | Value |
   |---|---|
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | l'adresse `…@….iam.gserviceaccount.com` |
   | `GOOGLE_PRIVATE_KEY` | le contenu du champ `private_key` du fichier JSON |

   Pour `GOOGLE_PRIVATE_KEY` : ouvrir le fichier JSON avec un éditeur de texte,
   repérer la ligne `"private_key": "-----BEGIN PRIVATE KEY-----\n…"` et copier
   **la valeur entre guillemets**, sans les guillemets. Les `\n` peuvent être
   laissés tels quels : l'application les rétablit.

3. Cocher les environnements voulus (**Preview** pour tester, **Production**
   quand vous validez), puis **Save**.
4. Redéployer (onglet **Deployments** → dernier déploiement → **Redeploy**)
   pour que les variables soient prises en compte.

Ces deux variables n'ont **pas** le préfixe `NEXT_PUBLIC_` : elles restent sur
le serveur et ne sont jamais envoyées au navigateur.

Sans elles, l'application continue de fonctionner normalement : la page de
configuration indique simplement que la connexion Google n'est pas en place.

---

## Étape 5 — Configurer la source dans TRUST AI

1. Se connecter à TRUST AI avec un compte **responsable logistique**,
   **direction** ou **administrateur**.
2. Menu **Logistique** → **Configurer le récapitulatif**
   (`/logistique/recap`).
3. Remplir :
   - **Identifiant du fichier** : la suite de caractères notée à l'étape 2 ;
   - **Nom de l'onglet** : `RECAP` (ou le vôtre) ;
   - **Ligne des titres** : `1` en général ;
   - **Colonne d'identifiant** : `ID TRUST`.
4. **Correspondance des colonnes** : pour chaque information attendue par
   TRUST AI, indiquer le **titre exact** de la colonne du fichier. Les
   accents, espaces et majuscules n'ont pas d'importance ; l'ordre des
   colonnes non plus.

   | Champ affiché dans TRUST AI | Colonne typique du fichier |
   |---|---|
   | ID TRUST | `ID TRUST` (colonne créée à l'étape 3) |
   | Date | `DATE` |
   | Fournisseur | `FOURNISSEUR` |
   | Statut | `STATUT` |
   | Référence fournisseur | `RÉFÉRENCE` |
   | Désignation | `DÉSIGNATION` |
   | Quantité | `QTÉ` |
   | Client | `CLIENT` |
   | ORDER (n° de commande **fournisseur**) | `ORDER` |
   | Arrivée prévue | `ARRIVAGE PRÉVU` |
   | Commentaires | `COMMENTAIRES` |
   | Réception Argenteuil | `REÇU ARGENTEUIL` |
   | Date réception Argenteuil | `DATE RÉCEPTION ARGENTEUIL` |
   | Affrètement | `AFFRÈTEMENT` |
   | Mode de sortie / transporteur | `MODE DE SORTIE` |
   | Réception Aubagne | `REÇU AUBAGNE` |
   | Date réception Aubagne | `DATE RÉCEPTION AUBAGNE` |
   | Livraison ou retrait final | `SORTIE DÉFINITIVE` |
   | Date finale | `DATE SORTIE` |

   Une colonne laissée vide est simplement ignorée.

5. **Enregistrer**, puis **Prévisualiser**. La prévisualisation lit le fichier
   et affiche ce que TRUST AI comprendrait — **sans rien écrire**. C'est le
   moment de corriger la correspondance des colonnes.
6. Quand la prévisualisation est juste : **Synchroniser maintenant**.
7. Menu **Logistique** → **Lignes du récapitulatif** (`/logistique/lignes`)
   pour consulter, filtrer et ouvrir le détail de chaque ligne.

---

## Comment TRUST AI lit le fichier

Ces règles ont été fixées avec vous ; elles sont vérifiées par des tests
automatiques à chaque modification du code.

- **`ORDER` est le numéro de commande FOURNISSEUR**, jamais celui du client.
- **Herblay est un magasin**, **Argenteuil un dépôt**, **Aubagne un dépôt
  doublé d'un magasin**. « Marseille » est un ancien nom d'Aubagne : les deux
  désignent le même dépôt, jamais deux endroits.
- **Argenteuil → Aubagne est un transfert**, pas deux disponibilités : la
  marchandise n'est comptée disponible **qu'une fois**, à destination.
- **Une réception partielle ne rend jamais la ligne disponible.**
- **Une destination non reconnue n'est jamais devinée** : la ligne reçoit une
  anomalie « destination ambiguë » et attend un arbitrage humain.
- Les **lignes de total** et les lignes vides sont ignorées.
- Les dates sont comprises au format français (`05/08/2026`), au format ISO
  (`2026-08-05`) et au format interne de Google Sheets.
- Les cases de réception acceptent `oui`, `x`, `ok`, `✔`, `vrai`… et leurs
  contraires. Une cellule **vide** signifie « on ne sait pas » ; une cellule
  contenant seulement `-` ou `/` signifie « non ».

### Une ligne qui disparaît du fichier

Elle n'est **jamais supprimée**. TRUST AI la marque « absente du fichier
depuis le … » et ouvre une anomalie. Si elle réapparaît, le marquage se lève
tout seul.

### Une ligne déjà sortie ou annulée dans TRUST AI

Elle ne « recule » pas : le suivi interne l'emporte sur le fichier pour ces
deux états.

---

## Relancer la lecture

La synchronisation se lance **à la demande**, depuis le bouton
**Synchroniser maintenant**. Elle est **idempotente** : la relancer dix fois
de suite ne crée aucun doublon, ni de ligne, ni d'événement, ni d'anomalie.

Le bandeau « Dernière lecture » de la page de configuration indique la date,
le nombre de lignes lues, créées, modifiées, ignorées et les erreurs.

---

## Et si ça ne marche pas ?

| Message | Cause probable | Ce qu'il faut faire |
|---|---|---|
| « Connexion Google Sheets non configurée » | Variables absentes dans Vercel | Étape 4, puis **redéployer** |
| « Accès refusé par Google » | Le fichier n'est pas partagé avec le compte de service | Étape 2 : partager en **Lecteur** |
| « Fichier introuvable » | Identifiant du fichier erroné | Recopier la partie entre `/d/` et `/edit` |
| Aucune ligne lue | Nom d'onglet ou ligne de titres erronés | Recopier le nom **exact** de l'onglet |
| Beaucoup d'anomalies « destination ambiguë » | Colonne `MODE DE SORTIE` mal associée | Vérifier la correspondance des colonnes |
| Des lignes en double | La colonne `ID TRUST` n'existe pas ou le script n'est pas installé | Étape 3 |

---

## Rappels de sécurité

- Ni l'adresse du compte de service, ni la clé privée ne sont stockées dans
  Supabase ni écrites dans les journaux.
- La clé privée ne doit **jamais** être collée dans une conversation, un
  ticket, un e-mail ou le dépôt GitHub. Si cela arrivait : Google Cloud →
  compte de service → onglet **Clés** → supprimer la clé, en créer une
  nouvelle, mettre à jour Vercel.
- L'autorisation demandée à Google est `spreadsheets.readonly` : même en cas
  de bug, TRUST AI ne **peut pas** écrire dans le fichier.
- Les tables logistiques ne sont lisibles par aucun navigateur, même
  administrateur : tout passe par des fonctions serveur qui rejouent les
  permissions et l'isolation par organisation.
