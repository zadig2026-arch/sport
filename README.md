# Sport — Programme Machines Confort

App web locale (PWA) pour suivre ton programme depuis ton iPhone à la salle.

- **Programme** : 12 semaines, full body 3x/semaine, 2 phases (adaptation → progression). Dominante machines + compound maîtrisés (squat, bench, overhead press, tractions).
- **Tracker** : coche chaque série, note tes charges, vois la charge de la séance précédente pour viser la progression
- **Timer de repos** : lancé auto quand tu valides une série
- **Suivi de poids** : pesée hebdo, graphique, alertes d'ajustement calorique
- **Plan nutrition budget** : 2850 kcal/jour pour ~5€/jour, liste de courses intégrée
- **Fonctionne hors-ligne** (service worker) une fois installé

## Installation sur iPhone (pas besoin d'internet en salle)

### Étape 1 — Démarrer le serveur local sur ton Mac

Depuis le Terminal :

```bash
cd /Users/zag/Documents/Github/Tools/Sport
python3 -m http.server 8000
```

Laisse cette fenêtre ouverte. Récupère l'IP locale du Mac :

```bash
ipconfig getifaddr en0
```

(Ex : `192.168.1.42`.)

### Étape 2 — Ouvrir sur l'iPhone

1. Assure-toi que l'iPhone est **sur le même WiFi** que le Mac
2. Dans Safari sur l'iPhone : `http://192.168.1.42:8000` (remplace par ton IP)
3. L'app s'ouvre

### Étape 3 — Ajouter à l'écran d'accueil

1. Dans Safari, appuie sur le bouton **Partager** (carré avec flèche vers le haut)
2. Fais défiler puis choisis **« Sur l'écran d'accueil »**
3. Nomme **Sport** → **Ajouter**
4. L'icône apparaît sur ton écran d'accueil. Lance-la depuis là.

### Étape 4 — Utilisation hors-ligne

Au premier lancement **avec** réseau, le service worker met tout en cache.
Ensuite, même sans WiFi à la salle, l'app fonctionne — toutes tes charges et pesées sont sauvegardées dans `localStorage` sur l'iPhone.

## Alternative : héberger sur GitHub Pages

Si tu veux y accéder partout sans avoir besoin du Mac allumé :

```bash
cd /Users/zag/Documents/Github/Tools/Sport
git init && git add . && git commit -m "Sport app"
# Crée un repo sur GitHub puis :
git remote add origin git@github.com:<ton-user>/sport.git
git push -u origin main
# Dans Settings > Pages : activer depuis la branche main → /
```

URL publique → installable partout.

## Structure

```
Sport/
├── index.html            # 3 onglets : Séance / Suivi / Nutrition
├── style.css             # Dark mode mobile-first
├── app.js                # Logique + localStorage + timer + graphique
├── manifest.webmanifest  # Config PWA
├── sw.js                 # Service worker offline
├── icon-192.png          # Icône écran d'accueil
├── icon-512.png          # Icône HD
└── data/
    ├── programme.json    # 2 phases × 3 séances × exercices détaillés
    └── nutrition.json    # Repas, liste de courses, macros
```

## Modifier le programme

Édite `data/programme.json` — change les exercices, séries, reps, notes. Les modifs apparaissent après rafraîchissement (force-refresh sur iPhone : maintenir l'icône → supprimer → réinstaller pour vider le cache SW).

## Reset des données

Dans l'onglet **Suivi** → bouton rouge "Effacer toutes les données".

## Réglage phase / semaine courante

Icône ⚙ en haut à droite → règle la semaine et la phase actuelle (la semaine affichée dans le badge est purement indicative — le contenu des séances vient de la phase choisie).

## Rappels essentiels (écrits dans l'app mais clés)

- **Manger même sans faim** — erreur n°1 des ectomorphes
- **Créatine monohydrate** 3-5g/jour — seul supplément prouvé
- **Sommeil 8h minimum** — gains divisés par 2 en dessous
- **Surcharge progressive** — +2,5 kg ou +1 rep par semaine dès que l'exécution est propre
- **Pas de cardio intense** — max 1 marche par semaine, sinon tu brûles ton surplus
