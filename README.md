# Grind This Game

Prototype jouable d’un RPG solo 2D à combats automatiques. TypeScript strict, Vite, Phaser, React, Electron et Vitest. Le moteur de règles est isolé dans `src/game` et ne dépend pas de Phaser ni de React.

## Démarrer

```powershell
npm install
npm run dev
```

Ouvrir l’URL affichée par Vite. Dans le jeu : WASD, ZQSD ou flèches pour marcher ; Échap ou Espace pour mettre en pause ; I pour l’inventaire ; C pour le personnage. Sur une manette standard, stick gauche/croix directionnelle pour se déplacer, A/B pour valider et haut/bas pour parcourir les contrôles. Le déplacement contre un obstacle ne compte pas pour les rencontres.

## Vérifications et application Windows

```powershell
npm test
npm run typecheck
npm run build
npm run electron:dev
npm run electron:build
```

`electron:build` compile le jeu localement puis produit un dossier Windows x64 non installé sous `release/windows/win-unpacked`. Aucun identifiant Steam ni SDK Steamworks n’est embarqué. L’intégration future devra ajouter Steamworks, la correspondance des achievements internes, Steam Cloud, les appels Overlay, des essais sur plusieurs manettes et la publication des builds via SteamPipe.

## Règles du prototype

- Les statistiques sont des nombres lisibles ; la vitesse est un multiplicateur positif (minimum 0,2), les chances critiques sont bornées à 75 %, les PV sont arrondis à l’entier et les dégâts minimums valent 1.
- La défense réduit les dégâts selon `défense / (défense + 100)`, plafonnée à 72 %. Les statistiques finales sont recalculées depuis la classe, les points investis, l’équipement et les passifs : changer d’objet ne conserve aucun bonus périmé.
- La chronologie utilise des dates d’action `temps + 1 / vitesse`, sans arrondir les rapports fractionnaires. La première action survient après un intervalle ; à égalité le joueur agit d’abord, puis les ennemis suivent l’ordre stable de la rencontre. Une unité morte n’agit plus.
- Les critiques sont tirés avec le PRNG de partie. Les décisions et le loot utilisent le même générateur xorshift32 à état sérialisable ; les vitesses ×1/×2/×4 changent le temps de présentation, pas les dégâts ni l’ordre des décisions.
- Les probabilités de rencontre sont contrôlées tous les 96 pixels parcourus. La jauge gagne 0,00065 par pixel, la chance au contrôle vaut `8 % + jauge × 35 %` et une jauge pleine rend le contrôle certain. Le moteur reçoit la distance déplacée réellement, après collisions.
- Le loot est un tirage exclusif par monstre : chance de base 12 %, majorée par la Chance et plafonnée à 45 %, puis tirage pondéré parmi les objets débloqués. La Chance augmente aussi progressivement le poids relatif des objets rares/épiques. Un objet verrouillé n’est jamais candidat. Les achievements validés en fin de combat ouvrent les tirages des combats suivants.
- Le poison s’ajoute jusqu’à 50 dégâts par action et sa durée est bornée à cinq actions ; un bouclier absorbe des dégâts jusqu’à épuisement et est renouvelé au début du combat. Les attaques supplémentaires ne déclenchent pas d’autres effets d’attaque ; la résolution borne les chaînes d’effets.
- Potion : soin plafonné à 35 % des PV maximum par utilisation. Le sanctuaire fixe soigne jusqu’à 45 PV une fois par partie. La réattribution des points est gratuite.
- Quitter pendant un combat reprend le combat depuis son état initial enregistré et son état PRNG initial ; les récompenses ne sont écrites qu’à la résolution du combat.

## Contenu et édition

Les définitions éditables sont dans `src/game/content.ts`. Ajouter un monstre : ajouter un `EnemyDefinition` avec identifiant stable, statistiques et table de loot, puis le référencer dans la zone voulue. Ajouter un objet : ajouter une `ItemDefinition`, emplacement/bonus/effets et éventuellement un identifiant d’achievement existant. Ajouter un passif : ajouter une `PassiveDefinition` avec classe, poids, rang maximum et condition de déblocage. Ajouter un achievement : compléter `ACHIEVEMENTS`, puis relier ses identifiants de déblocage ; `validateContent()` vérifie les identifiants et principales références. Les exemplaires trouvés sont des instances séparées des définitions et portent leurs propres identifiants dans la sauvegarde.

## Sauvegardes et architecture

- `src/game/engine.ts` : statistiques, expérience, rencontres, passifs (dont déblocages par maîtrise), loot, combat, progression et validation/migration de partie.
- `src/game/PlatformScene.ts` : monde 3600×2600 avec caméra centrée sur le joueur, brouillard de guerre (zones découvertes enregistrées dans la sauvegarde), collisions, déplacements, manette et interactions de carte.
- `src/game/world.ts` : forme organique des cinq zones (régions déformées par du bruit), décors générés de façon déterministe par biome, positions du sanctuaire, des secrets et du boss.
- `src/ui/` : interfaces React ; aucun state React n’est mis à jour à chaque image.
- `src/game/save.ts` : partie versionnée dans localStorage et profil/paramètres locaux.
- `electron/` : fenêtre isolée, preload minimal, IPC limité aux sauvegardes, écriture atomique et copie de secours.

Le profil (maîtrise, achievements et déblocages) est distinct de la partie ; l’équipement trouvé disparaît avec la partie. Les sauvegardes de partie sont versionnées, les anciennes données version 0 sont migrées et une copie valide peut remplacer une partie corrompue. Les achievements fonctionnent hors ligne ; `src/game/platform.ts` expose un adaptateur local neutre en attente de Steamworks.

## Progression, style et combat

- Style néon épuré façon TRON : obstacles vifs avec disque de collision visible, décor sans collision atténué.
- Chaque zone a un boss gardien ; la zone suivante reste verrouillée tant qu'il n'est pas vaincu (le dernier boss clôt la partie). La Prairie ne produit que des rencontres à un seul ennemi, les groupes grandissent ensuite (max 2 puis 3).
- Combat illustré plein écran (ennemis de face, barres de vie dessous) et icônes pour tous les objets et passifs, avec une couleur par rareté. La barre de danger en bas de l'écran monte en continu.

## Limites connues

Ce premier prototype contient deux personnages, cinq zones aux environnements distincts, dix ennemis ordinaires et un boss, 14 objets (dont consommables), six passifs par classe, deux secrets et un sanctuaire. Le mode développeur de l’écran titre permet d’aller directement dans chaque zone, d’ajouter un niveau/objet et de lancer un combat choisi. Il ne contient pas encore une campagne complète équilibrée, un remappage des touches, un mixage audio (le volume est enregistré mais aucun son n’est livré), ni une vérification matérielle des manettes. Les chemins persistants sont enregistrés par achievement, mais ne pilotent pas encore des portes spécifiques. Les builds Windows nécessitent une machine disposant des dépendances npm et n’ont pas été signés. Aucun backend ni accès réseau n’est nécessaire à l’exécution ; les ressources visuelles et audio sont dessinées/absentes.

Les tests automatisés couvrent les règles déterministes ; l’intégration Electron, l’accessibilité réelle à la manette et l’exécution native Windows doivent encore être vérifiées sur la machine cible.
