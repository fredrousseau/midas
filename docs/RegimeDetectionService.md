# RegimeDetectionService - Documentation

## Vue d'ensemble

Le `RegimeDetectionService` est un service de détection automatique de régimes de marché qui combine plusieurs indicateurs techniques pour classifier l'état actuel du marché. Il identifie 9 types de régimes différents (tendances, breakouts, ranges) et calcule un score de confiance multi-critères.

## Architecture

Le service s'intègre dans l'architecture du projet en s'appuyant sur :
- **dataProvider** : Chargement des données OHLCV
- **indicatorService** : Calcul des indicateurs techniques (ADX, ATR, EMA)
- **logger** : Journalisation des opérations

### Calculs internes

Le service utilise exclusivement l'`indicatorService` pour les indicateurs standards (ADX avec ±DI, ATR, EMA).

Seul le calcul suivant est effectué localement :
- **Efficiency Ratio (ER)** : Calcul personnalisé avec lissage EMA intégré, non disponible dans l'indicatorService

## Configuration

### Périodes des indicateurs

```javascript
config = {
  adxPeriod: 14,           // Période ADX
  erPeriod: 10,            // Période Efficiency Ratio
  erSmoothPeriod: 3,       // Période de lissage de l'ER
  atrShortPeriod: 14,      // Période ATR court terme
  atrLongPeriod: 50,       // Période ATR long terme
  maShortPeriod: 20,       // Période EMA court terme
  maLongPeriod: 50,        // Période EMA long terme
  minBars: 60              // Minimum de barres requises
}
```

### Seuils de détection

**ADX (Average Directional Index)**
```javascript
adx: {
  weak: 20,        // Tendance faible
  trending: 25,    // Tendance confirmée
  strong: 40       // Tendance forte
}
```

**Efficiency Ratio**
```javascript
er: {
  choppy: 0.3,     // Marché choppy/range
  trending: 0.5    // Marché en tendance
}
```

**ATR Ratio**
```javascript
atrRatio: {
  low: 0.8,        // Faible volatilité
  high: 1.3        // Forte volatilité
}
```

## Méthode principale : `detectRegime()`

### Paramètres

```javascript
detectRegime({
  symbol,          // Requis : Symbole à analyser (ex: 'BTC/USDT')
  timeframe,       // Défaut: '1h' - Timeframe d'analyse
  count,           // Défaut: 200 - Nombre de barres
  analysisDate,    // Optionnel : Date d'analyse (backtesting)
  useCache,        // Défaut: true - Utiliser le cache
  detectGaps       // Défaut: true - Détecter les gaps
})
```

### Processus de détection

1. **Chargement des données OHLCV** via `dataProvider`
   - Charge automatiquement `Math.max(count, 60 + 50)` barres pour éviter le biais de warmup

2. **Calcul parallèle** de 6 indicateurs (via `Promise.all`) :
   - ADX avec +DI et -DI (via IndicatorService)
   - ATR court terme (14) et long terme (50)
   - Efficiency Ratio (calcul local avec lissage EMA)
   - EMA court terme (20) et long terme (50)

3. **Détection de la direction** :
   - Hypothèse directionnelle basée sur la structure EMA
   - Filtre de confirmation via les Directional Indicators (±DI)
   - Calcul de la force directionnelle normalisée par ATR long

4. **Détection du type de régime** :
   - Ordre de priorité : Breakout → Trending → Range
   - Basé sur ADX, ER et ratio ATR

5. **Calcul du score de confiance multi-composants** :
   - Regime Clarity Score (35%)
   - Signal Coherence (30%)
   - Direction Score (20%)
   - ER Score (15%)

### Structure de retour

```javascript
{
  regime: string,           // Type de régime (8 valeurs possibles)
  direction: string,        // Direction globale : 'bullish' | 'bearish' | 'neutral'
  confidence: number,       // Score de confiance (0.00 à 1.00)
  components: {
    adx: number,           // Valeur ADX (2 décimales)
    plusDI: number,        // +DI (2 décimales)
    minusDI: number,       // -DI (2 décimales)
    efficiency_ratio: number,  // ER (4 décimales)
    atr_ratio: number,     // Ratio ATR court/long (4 décimales)
    direction: {
      direction: string,   // 'bullish' | 'bearish' | 'neutral'
      strength: number,    // Force normalisée (-2 à +2, 4 décimales)
      emaShort: number,    // EMA courte (2 décimales)
      emaLong: number      // EMA longue (2 décimales)
    }
  },
  metadata: {
    symbol: string,
    timeframe: string,
    barsUsed: number,
    firstTimestamp: number,
    lastTimestamp: number,
    gapCount: number,
    fromCache: boolean,
    loadDuration: number,    // ms
    detectionDuration: number, // ms
    loadedAt: string         // ISO 8601
  }
}
```

## Définition des régimes de marché

### 📈 TENDANCE (Trending)

**Définition** : Mouvement directionnel soutenu et efficace du prix dans une direction donnée (haussière ou baissière).

**Caractéristiques** :
- **ADX ≥ 25** : Force de tendance confirmée
- **Efficiency Ratio ≥ 0.5** : Mouvement directionnel efficace (peu de bruit)
- **Direction claire** : Prix et moyennes mobiles alignées
- **Momentum soutenu** : Le prix progresse de manière cohérente

**Analogie** : Une rivière qui coule régulièrement dans une direction - le courant est fort et constant.

### 💥 BREAKOUT

**Définition** : Explosion soudaine de volatilité accompagnée d'un mouvement directionnel fort, souvent après une période de consolidation.

**Caractéristiques** :
- **ATR ratio > 1.3** : Volatilité en forte expansion (court terme > long terme)
- **ADX > 25** : Force directionnelle en augmentation
- **Mouvement rapide** : Sortie d'une zone de consolidation
- **Volume souvent élevé** : Participation accrue du marché

**Analogie** : Un barrage qui cède - l'énergie accumulée se libère brutalement dans une direction.

### 📊 RANGE

**Définition** : Mouvement latéral du prix entre des niveaux de support et résistance, sans direction claire ni tendance établie.

**Caractéristiques** :
- **ADX < 25** : Absence de tendance forte
- **Efficiency Ratio < 0.5** : Mouvement inefficace, beaucoup de bruit
- **Prix oscillant** : Va-et-vient entre bornes supérieure et inférieure
- **Indécision** : Aucune direction dominante

**Analogie** : Une balle de tennis qui rebondit entre deux murs - mouvement répétitif sans progression.

### 📋 Tableau comparatif

| Critère | Tendance | Breakout | Range |
|---------|----------|----------|-------|
| **ADX** | ≥ 25 | > 25 | < 25 |
| **ER** | ≥ 0.5 | Variable | < 0.5 |
| **ATR Ratio** | Variable | > 1.3 | Variable |
| **Direction** | Claire et soutenue | Émergente et explosive | Absente ou confuse |
| **Volatilité** | Stable | En expansion | Stable ou variable |
| **Mouvement** | Linéaire efficace | Explosif rapide | Latéral répétitif |
| **Stratégies adaptées** | Suivi de tendance | Trading de cassure | Mean reversion |

### 🎯 Transitions typiques

```
Range (consolidation)
    ↓
Breakout (explosion)
    ↓
Tendance (continuation)
    ↓
Range (épuisement)
```

Le cycle typique : accumulation (range) → distribution (breakout) → tendance → retour au range.

## Valeurs possibles pour `regime`

### Régimes de tendance (2 types)

**Conditions** : ADX ≥ 25 ET Efficiency Ratio ≥ 0.5

- **`trending_bullish`** : Tendance haussière confirmée
  - Prix > EMA court > EMA long
  - +DI > -DI (confirmation directionnelle)
  - ADX ≥ 25
  - ER ≥ 0.5

- **`trending_bearish`** : Tendance baissière confirmée
  - Prix < EMA long ET EMA court < EMA long
  - -DI > +DI (confirmation directionnelle)
  - ADX ≥ 25
  - ER ≥ 0.5

### Régimes de breakout (3 types)

**Conditions** : ATR ratio > 1.3 ET ADX ≥ 25

- **`breakout_bullish`** : Breakout haussier
  - ATR ratio > 1.3 (volatilité en expansion)
  - Direction bullish confirmée par ±DI
  - ADX ≥ 25

- **`breakout_bearish`** : Breakout baissier
  - ATR ratio > 1.3 (volatilité en expansion)
  - Direction bearish confirmée par ±DI
  - ADX ≥ 25

- **`breakout_neutral`** : Breakout sans direction claire
  - ATR ratio > 1.3 (volatilité en expansion)
  - ADX ≥ 25
  - Direction neutralisée par contradiction ±DI/EMA

### Régimes de range (3 types)

**Conditions** : Autres cas (ADX < 25 ou ER < 0.5)

- **`range_low_vol`** : Range avec faible volatilité
  - ATR ratio < 0.8
  - ADX généralement bas
  - ER bas

- **`range_high_vol`** : Range avec forte volatilité
  - ATR ratio > 1.3
  - Mais ADX bas (pas de tendance)
  - ER bas

- **`range_normal`** : Range avec volatilité normale
  - ATR ratio entre 0.8 et 1.3
  - ADX bas
  - ER bas

## Calcul de la direction

La direction du marché utilise un processus en deux étapes :

### 1. Hypothèse directionnelle (Structure EMA)

Basée sur la structure des moyennes mobiles :

- **`bullish`** (Haussier)
  - Prix > EMA court > EMA long

- **`bearish`** (Baissier)
  - Prix < EMA long ET EMA court < EMA long

- **`neutral`** (Neutre)
  - Autres cas (structure mixte)

### 2. Filtre de confirmation (±DI)

Les Directional Indicators valident ou neutralisent l'hypothèse EMA :

- Si direction = `bullish` MAIS +DI < -DI → direction devient `neutral`
- Si direction = `bearish` MAIS -DI < +DI → direction devient `neutral`

Ce filtre réduit les faux signaux de tendance dans les marchés range ou bruyants.

### Strength (Force directionnelle)

La force est normalisée par l'ATR long pour stabilité multi-symboles :

```javascript
strength = clamp((emaShort - emaLong) / atrLong, -2, 2)
```

- Valeur **positive** : Force haussière
- Valeur **négative** : Force baissière
- Proche de **zéro** : Direction faible
- **Bornée entre -2 et +2** pour éviter les valeurs aberrantes

## Score de confiance

Le score de confiance combine 4 critères indépendants :

### 1. Regime Clarity Score (Clarté du régime)

Évalue la cohérence entre l'ADX et le type de régime :

**Pour tendances/breakouts :**
- ADX > 40 → Score 1.0 (très forte)
- ADX > 25 → Score 0.7 (forte)
- ADX > 20 → Score 0.5 (modérée)
- Autres → Score 0.3 (faible)

**Pour ranges :**
- ADX < 20 → Score 0.8 (forte)
- ADX < 25 → Score 0.6 (modérée)
- Autres → Score 0.4 (faible)

### 2. ER Score (Efficiency Ratio)

Évalue l'adéquation de l'Efficiency Ratio, **adapté au régime** :

**Pour tendances (trending) :**
- ER > 0.7 → Score 1.0
- ER > 0.5 → Score 0.7
- Autres → Score 0.4

**Pour breakouts :**
- ER > 0.4 → Score 1.0
- ER > 0.3 → Score 0.7
- Autres → Score 0.4

**Pour ranges :**
- ER < 0.25 → Score 1.0
- ER < 0.35 → Score 0.7
- Autres → Score 0.4

### 3. Direction Score (Force de direction)

Basé sur la valeur absolue de `direction.strength` :

- |strength| > 0.8 → Score 1.0
- |strength| > 0.5 → Score 0.7
- |strength| > 0.25 → Score 0.5
- Autres → Score 0.3

### 4. Coherence Score (Cohérence logique)

Vérifie la cohérence entre tous les indicateurs selon des règles spécifiques pour chaque régime.

**Exemple pour `trending_bullish` :**
- ADX ≥ 25 ✓
- ER ≥ 0.5 ✓
- Direction = bullish ✓

Score = nombre de règles satisfaites / nombre total de règles

### Score final

**Moyenne pondérée** des 4 composants :

```javascript
confidence = 0.35 × regimeClarityScore
           + 0.30 × coherenceScore
           + 0.20 × directionScore
           + 0.15 × erScore
```

Arrondi à 2 décimales (0.00 à 1.00)

**Pondération justifiée** :
- **35% Regime Clarity** : Le plus important - mesure la cohérence ADX/régime
- **30% Coherence** : Accord global entre tous les indicateurs
- **20% Direction** : Force exploitable de la direction
- **15% ER** : Complément utile mais moins critique

## Indicateurs utilisés

### ADX (Average Directional Index)

- **Mesure** : Force de la tendance (0-100+)
- **Calcul** : Utilise +DI, -DI et leur différence lissée
- **Interprétation** :
  - ADX < 20 : Pas de tendance (range)
  - ADX 20-25 : Tendance faible
  - ADX > 25 : Tendance confirmée
  - ADX > 40 : Tendance forte

### ATR (Average True Range)

- **Mesure** : Volatilité absolue
- **Périodes** : Court terme (14) et long terme (50)
- **Ratio** : ATR court / ATR long
  - Ratio < 0.8 : Volatilité en baisse
  - Ratio > 1.3 : Volatilité en hausse

### Efficiency Ratio (ER)

- **Mesure** : Efficacité du mouvement de prix
- **Formule** : Mouvement net / Somme des mouvements absolus
- **Calcul** : Personnalisé en local (non disponible dans l'IndicatorService)
- **Lissage** : EMA à 3 périodes pour stabilité
- **Interprétation** :
  - ER proche de 0 : Marché choppy, mouvements inefficaces
  - ER proche de 1 : Mouvement directionnel très efficace
  - ER ≥ 0.5 : Tendance efficace
  - ER ≤ 0.3 : Range/choppy

### Directional Indicators (±DI)

- **Mesure** : Direction du mouvement de prix
- **Source** : Récupérés via IndicatorService (composants de l'ADX)
- **Composants** :
  - **+DI** : Force du mouvement haussier (0-100+)
  - **-DI** : Force du mouvement baissier (0-100+)
- **Usage** :
  - Filtre de confirmation pour la direction basée sur les EMA
  - Si +DI > -DI : pression haussière
  - Si -DI > +DI : pression baissière

### EMA (Exponential Moving Average)

- **Périodes** : Court terme (20) et long terme (50)
- **Usage** : Détermination de la direction du marché
- **Relation** : Position relative du prix et des EMAs

## Plages de valeurs

### Valeurs numériques typiques

- **confidence** : 0.00 à 1.00
- **adx** : 0 à 100+ (typiquement 0-60)
- **plusDI / minusDI** : 0 à 100+
- **efficiency_ratio** : 0.0000 à 1.0000
- **atr_ratio** : 0.0000+ (généralement 0.5 à 2.0)
- **direction.strength** : Peut être négatif ou positif

## Exemple d'utilisation

```javascript
const regimeService = new RegimeDetectionService({
  logger: logger,
  dataProvider: dataProvider,
  indicatorService: indicatorService
});

const result = await regimeService.detectRegime({
  symbol: 'BTC/USDT',
  timeframe: '1h',
  count: 200,
  useCache: true
});

console.log(`Régime: ${result.regime}`);
console.log(`Confiance: ${result.confidence}`);
console.log(`Direction: ${result.components.direction.direction}`);
```

### Exemple de retour

```javascript
{
  regime: 'trending_bullish',
  direction: 'bullish',
  confidence: 0.82,
  components: {
    adx: 32.45,
    plusDI: 28.60,
    minusDI: 12.30,
    efficiency_ratio: 0.6234,
    atr_ratio: 1.1250,
    direction: {
      direction: 'bullish',
      strength: 0.8500,
      emaShort: 45230.25,
      emaLong: 44850.10
    }
  },
  metadata: {
    symbol: 'BTC/USDT',
    timeframe: '1h',
    barsUsed: 200,
    firstTimestamp: 1703001600000,
    lastTimestamp: 1703721600000,
    gapCount: 0,
    fromCache: true,
    loadDuration: 45,
    detectionDuration: 123,
    loadedAt: '2025-12-28T10:30:00.000Z'
  }
}
```

## Fonctions utilitaires

### Helpers d'arrondi

- **`round2(x)`** : Arrondit à 2 décimales (pour prix, ADX, DI, EMA)
- **`round4(x)`** : Arrondit à 4 décimales (pour ER, ratios, strength)

## Points forts

✅ **Architecture propre** avec séparation des responsabilités
✅ **Utilisation optimale de l'IndicatorService** pour tous les indicateurs standards (ADX, ±DI, ATR, EMA)
✅ **Performance** avec calculs parallèles via `Promise.all`
✅ **Documentation inline complète** expliquant chaque phase de détection
✅ **Filtre de confirmation ±DI** pour réduire les faux signaux de tendance
✅ **Score de confiance pondéré** favorisant la clarté du régime et la cohérence des signaux
✅ **Logging** informatif pour le débogage
✅ **Métadonnées riches** dans le résultat (cache, durée, gaps)
✅ **Flexibilité** via les paramètres `analysisDate`, `useCache`, `detectGaps`

## Améliorations récentes (version actuelle)

✨ **Logique consolidée** : Code refactorisé avec méthodes helper intégrées au flux principal
✨ **Documentation inline** : Commentaires détaillés expliquant chaque phase (1-8) du processus de détection
✨ **Utilisation de ±DI via IndicatorService** : Plus besoin de calcul local des Directional Indicators
✨ **Filtre de confirmation directionnel** : Les ±DI neutralisent les faux signaux EMA dans les ranges
✨ **Score de confiance pondéré** : Poids adaptés (35% clarity, 30% coherence, 20% direction, 15% ER)
✨ **Lissage ER configurable** : Période `erSmoothPeriod` pour contrôler la réactivité de l'Efficiency Ratio
✨ **Suppression de code mort** : Fonctions `rma()`, `calculateTrueRange()`, `_calculateDI()` éliminées

## Nombre de barres nécessaires

### Minimum technique

**60 barres** - Seuil minimal absolu défini dans `config.minBars`

Le service lance une erreur si moins de 60 barres sont disponibles.

### Barres chargées automatiquement

Le service charge automatiquement :
```javascript
count = Math.max(count_demandé, config.minBars + 50)
```

Soit **minimum 110 barres** pour éviter le **biais de warmup** des indicateurs.

### Recommandation par timeframe

Le nombre de **barres** reste constant (60-200), mais la **période temporelle** varie :

| Timeframe | 60 barres | 110 barres | 200 barres (optimal) |
|-----------|-----------|------------|----------------------|
| **1m** | 1 heure | 1h50 | 3h20 |
| **5m** | 5 heures | 9h10 | 16h40 |
| **15m** | 15 heures | 27h30 | 50h (~2 jours) |
| **1h** | 2.5 jours | 4.6 jours | **8.3 jours** |
| **4h** | 10 jours | 18 jours | **33 jours** |
| **1d** | 2 mois | 3.6 mois | **6.6 mois** |

### Justification technique

Les indicateurs les plus exigeants sont :

| Indicateur | Période | Warmup nécessaire |
|------------|---------|-------------------|
| ADX | 14 | ~14-28 barres |
| ATR Short | 14 | ~14 barres |
| **ATR Long** | **50** | **~50 barres** |
| EMA Short | 20 | ~20 barres |
| **EMA Long** | **50** | **~50 barres** |
| ER (lissé) | 10 + 3 | ~13 barres |

Les périodes longues (50) justifient le buffer de 50 barres supplémentaires.

### Recommandations pratiques

- **60 barres** : Minimum technique absolu
- **110 barres** : Recommandé pour résultats fiables
- **200 barres** : Optimal pour stabilité maximale (valeur par défaut de l'API)

**Note importante** : Les périodes d'indicateurs sont fixes quelle que soit la timeframe. Sur 1h, l'EMA 50 couvre ~2 jours, tandis que sur 1d elle couvre ~7 semaines. C'est la même logique d'analyse, mais à des échelles temporelles différentes.

## Fichier source

[RegimeDetectionService.js](../src/Trading/MarketAnalysis/RegimeDetection/RegimeDetectionService.js)
