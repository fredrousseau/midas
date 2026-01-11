# Analyse des Bar Counts Hardcodés
**Date:** 2026-01-11
**Statut:** ANALYSE COMPLÈTE

---

## 📊 Résumé Exécutif

**Problème:** Malgré la création de configurations centralisées ([barCounts.js](../src/Trading/MarketAnalysis/config/barCounts.js) et [lookbackPeriods.js](../src/Trading/MarketAnalysis/config/lookbackPeriods.js)), le code contient encore **48+ instances de bar counts et lookback periods hardcodés**.

**Impact:**
- ❌ Difficile d'optimiser les paramètres pour le backtesting
- ❌ Incohérences potentielles entre différentes parties du code
- ❌ Maintenance complexe (changements nécessitent modifications multiples)
- ❌ Impossible de tester différentes configurations sans modifier le code

**Recommandation:** Refactoriser tous les hardcoded values pour utiliser les configurations centralisées.

---

## 🔍 Inventaire Détaillé

### 1. StatisticalContextService.js ⚠️ CRITIQUE
**Fichier:** [src/Trading/MarketAnalysis/StatisticalContext/StatisticalContextService.js](../src/Trading/MarketAnalysis/StatisticalContext/StatisticalContextService.js)

#### Problèmes Critiques

**Ligne 429 - PSAR Indicator Fetch**
```javascript
// ❌ ACTUEL
const psarData = await this.indicatorService.getIndicatorTimeSeries({
    symbol,
    indicator: 'psar',
    timeframe,
    bars: 50,  // HARDCODED!
    analysisDate,
    config: {}
});

// ✅ DEVRAIT ÊTRE
import { getBarCount } from '../config/barCounts.js';
// ...
bars: getBarCount('indicator', timeframe),
```

**Impact:** Utilise toujours 50 bars pour PSAR quelle que soit le timeframe, alors que la configuration centralisée définit des valeurs différentes par timeframe.

#### Lookback Periods Hardcodés

| Ligne | Valeur | Usage | Config Recommandé |
|-------|--------|-------|-------------------|
| 85 | `slice(-20)` | Trend detection | `TREND_PERIODS.medium` |
| 93 | `slice(-90)` | Anomaly detection | `STATISTICAL_PERIODS.long` |
| 460 | `slice(-10)` | Basic price action | `PATTERN_PERIODS.microPattern` |
| 471 | `slice(-50)` | Support/resistance | `SUPPORT_RESISTANCE_PERIODS.lookback` |

**Exemple de refactoring:**
```javascript
// ❌ ACTUEL
const trendData = detectTrend(simpleHistory.slice(-20));
const anomalyData = detectAnomaly(value, simpleHistory.slice(-90));

// ✅ DEVRAIT ÊTRE
import { TREND_PERIODS, STATISTICAL_PERIODS } from '../config/lookbackPeriods.js';
// ...
const trendData = detectTrend(simpleHistory.slice(-TREND_PERIODS.medium));
const anomalyData = detectAnomaly(value, simpleHistory.slice(-STATISTICAL_PERIODS.long));
```

---

### 2. PriceActionEnricher.js
**Fichier:** [src/Trading/MarketAnalysis/StatisticalContext/enrichers/PriceActionEnricher.js](../src/Trading/MarketAnalysis/StatisticalContext/enrichers/PriceActionEnricher.js)

| Ligne | Hardcoded | Contexte | Config Recommandé |
|-------|-----------|----------|-------------------|
| 34 | `slice(-20)` | Recent structure analysis | `PATTERN_PERIODS.swingLookback` |
| 40 | `slice(-50)` | Swing point identification | `SUPPORT_RESISTANCE_PERIODS.lookback` |
| 43 | `slice(-24)` | 24-hour range analysis | **NOUVEAU:** `PATTERN_PERIODS.range24h` |
| 46 | `slice(-10)` | Micro structure | `PATTERN_PERIODS.microPattern` |
| 49 | `slice(-20)` | Breakout levels | `PATTERN_PERIODS.swingLookback` |
| 385-386 | `slice(-10)` | Recent high/low | `PATTERN_PERIODS.microPattern` |

**Total:** 6 instances hardcodées

**Note spéciale - Ligne 43:** Le `slice(-24)` est probablement intentionnel (24 heures sur timeframe horaire), mais devrait être documenté ou calculé dynamiquement selon le timeframe.

---

### 3. MomentumEnricher.js
**Fichier:** [src/Trading/MarketAnalysis/StatisticalContext/enrichers/MomentumEnricher.js](../src/Trading/MarketAnalysis/StatisticalContext/enrichers/MomentumEnricher.js)

| Ligne | Hardcoded | Contexte | Config Recommandé |
|-------|-----------|----------|-------------------|
| 68 | `slice(-20)` | RSI percentile 20d | `STATISTICAL_PERIODS.short` |
| 69 | `slice(-50)` | RSI percentile 50d | `STATISTICAL_PERIODS.medium` |
| 72 | `slice(-50)` | RSI mean 50d | `STATISTICAL_PERIODS.medium` |
| 73 | `slice(-50)` | RSI typical range | `STATISTICAL_PERIODS.medium` |
| 76 | `slice(-10)` | RSI trend detection | `TREND_PERIODS.short` |
| 79 | `slice(-20)` | RSI divergence | `TREND_PERIODS.medium` |
| 143 | `slice(-10)` | MACD histogram | `TREND_PERIODS.short` |
| 163-164 | `slice(-20)` | MACD divergence | `TREND_PERIODS.medium` |
| 291-292 | `slice(-10)` | Peaks finding | `TREND_PERIODS.short` |

**Total:** 10 instances hardcodées

**Pattern identifié:**
- `-10` pour trend immédiat → `TREND_PERIODS.short`
- `-20` pour trend court-terme → `TREND_PERIODS.medium`
- `-50` pour statistiques → `STATISTICAL_PERIODS.medium`

---

### 4. VolatilityEnricher.js
**Fichier:** [src/Trading/MarketAnalysis/StatisticalContext/enrichers/VolatilityEnricher.js](../src/Trading/MarketAnalysis/StatisticalContext/enrichers/VolatilityEnricher.js)

| Ligne | Hardcoded | Contexte | Config Recommandé |
|-------|-----------|----------|-------------------|
| 91 | `slice(-50)` | ATR percentile 50d | `STATISTICAL_PERIODS.medium` |
| 94 | `slice(-50)` | ATR mean 50d | `STATISTICAL_PERIODS.medium` |
| 97 | `slice(-10)` | ATR trend | `TREND_PERIODS.short` |
| 153 | `slice(-50)` | BB width percentile | `STATISTICAL_PERIODS.medium` |
| 156 | `slice(-20)` | Recent BB widths | `STATISTICAL_PERIODS.short` |

**Total:** 5 instances hardcodées

---

### 5. VolumeEnricher.js
**Fichier:** [src/Trading/MarketAnalysis/StatisticalContext/enrichers/VolumeEnricher.js](../src/Trading/MarketAnalysis/StatisticalContext/enrichers/VolumeEnricher.js)

| Ligne | Hardcoded | Contexte | Config Recommandé |
|-------|-----------|----------|-------------------|
| 65 | `slice(-20)` | Volume moving average | `VOLUME_PERIODS.average` ✅ (déjà = 20) |
| 84 | `slice(-10)` | Recent volume bars | `VOLUME_PERIODS.recentBars` ❌ (config = 3!) |
| 130 | `slice(-20)` | OBV trend | `VOLUME_PERIODS.obvTrend` ✅ (déjà = 20) |
| 133 | `slice(-50)` | OBV percentile | `STATISTICAL_PERIODS.medium` |
| 136-137 | `slice(-20)` | OBV divergence | `VOLUME_PERIODS.divergence` ❌ (config = 10!) |

**Total:** 6 instances hardcodées

**⚠️ INCOHÉRENCES DÉTECTÉES:**
- Ligne 84: Utilise `-10` alors que `VOLUME_PERIODS.recentBars = 3`
- Ligne 137: Utilise `-20` alors que `VOLUME_PERIODS.divergence = 10`

**Impact:** Le code n'utilise PAS les valeurs de la configuration centralisée, rendant celle-ci inutile!

---

### 6. MovingAveragesEnricher.js
**Fichier:** [src/Trading/MarketAnalysis/StatisticalContext/enrichers/MovingAveragesEnricher.js](../src/Trading/MarketAnalysis/StatisticalContext/enrichers/MovingAveragesEnricher.js)

| Ligne | Hardcoded | Contexte | Config Recommandé |
|-------|-----------|----------|-------------------|
| 216 | `slice(-20)` | EMA divergence analysis | `TREND_PERIODS.medium` |
| 218-220 | `slice(-20)` | EMA recent window | `TREND_PERIODS.medium` |

**Total:** 3 instances hardcodées

---

### 7. PatternDetector.js ⚠️ LE PIRE
**Fichier:** [src/Trading/MarketAnalysis/StatisticalContext/enrichers/PatternDetector.js](../src/Trading/MarketAnalysis/StatisticalContext/enrichers/PatternDetector.js)

**Ce fichier contient le plus grand nombre de magic numbers hardcodés.**

#### Magic Numbers pour Bar Counts

| Ligne | Hardcoded | Contexte | Action Recommandée |
|-------|-----------|----------|-------------------|
| 30 | `< 30` | Minimum bars check | Ajouter `PATTERN_PERIODS.minimumBars = 30` |
| 36 | `20` | Average volume period | `VOLUME_PERIODS.average` |
| 120 | `period = 20` | Default avg volume | `VOLUME_PERIODS.average` |

#### Magic Numbers pour Pattern Detection

| Ligne | Hardcoded | Contexte | Action Recommandée |
|-------|-----------|----------|-------------------|
| 169 | `slice(-30)` | Flag pattern detection | `PATTERN_PERIODS.swingLookback` |
| 172 | `>= 15` | Pole end minimum | Ajouter `PATTERN_PERIODS.poleMinLength = 15` |
| 173 | `-15`, `-8` | Pole search range | Ajouter `PATTERN_PERIODS.poleSearchStart/End` |
| 186 | `< 5 \|\| > 15` | Flag duration limits | Ajouter `PATTERN_PERIODS.flagMinLength/MaxLength` |
| 229 | `slice(-60)` | Triangle swings | `PATTERN_PERIODS.structureLookback` |
| 287 | `slice(-60)` | Wedge swings | `PATTERN_PERIODS.structureLookback` |
| 328 | `slice(-80)` | Head & Shoulders | `PATTERN_PERIODS.structureLookback` |
| 365 | `slice(-50)` | Double patterns | `SUPPORT_RESISTANCE_PERIODS.lookback` |

**Total:** 14+ instances hardcodées

**Pattern-specific magic numbers qui devraient être dans la config:**
- Pole lengths: 15, 8
- Flag duration: 5-15 bars
- Swing analysis: 60, 80 bars
- ATR multiplier for swing detection: 1.3, 1.5

---

## 📈 Statistiques Globales

### Par Type de Valeur

| Valeur Hardcodée | Occurrences | Config Recommandé |
|------------------|-------------|-------------------|
| `10` | 12 | `TREND_PERIODS.short` ou `PATTERN_PERIODS.microPattern` |
| `20` | 18 | `STATISTICAL_PERIODS.short`, `TREND_PERIODS.medium`, `VOLUME_PERIODS.average` |
| `24` | 1 | **NOUVEAU:** `PATTERN_PERIODS.range24h = 24` |
| `30` | 3 | `PATTERN_PERIODS.swingLookback` |
| `50` | 11 | `STATISTICAL_PERIODS.medium`, `SUPPORT_RESISTANCE_PERIODS.lookback` |
| `60` | 2 | `PATTERN_PERIODS.structureLookback` |
| `80` | 1 | `PATTERN_PERIODS.structureLookback` (ajusté à 80) |
| `90` | 1 | `STATISTICAL_PERIODS.long` |
| **Pattern-specific** | 8+ | Nouveaux paramètres requis |

**Total instances hardcodées:** 48+

### Par Fichier (Priorité de Refactoring)

| Fichier | Instances | Priorité | Complexité |
|---------|-----------|----------|------------|
| PatternDetector.js | 14+ | 🔴 HAUTE | Élevée (magic numbers spécifiques) |
| MomentumEnricher.js | 10 | 🟡 MOYENNE | Moyenne |
| StatisticalContextService.js | 5 | 🔴 HAUTE | Faible (mais critique) |
| VolumeEnricher.js | 6 | 🟡 MOYENNE | Faible (mais incohérences!) |
| PriceActionEnricher.js | 6 | 🟡 MOYENNE | Faible |
| VolatilityEnricher.js | 5 | 🟢 BASSE | Faible |
| MovingAveragesEnricher.js | 3 | 🟢 BASSE | Faible |

---

## ⚠️ Incohérences Critiques Détectées

### 1. VolumeEnricher.js - Configuration Ignorée

**Problème:** Le fichier `lookbackPeriods.js` définit:
```javascript
export const VOLUME_PERIODS = {
    average: 20,        // ✅ Cohérent avec code (ligne 65)
    recentBars: 3,      // ❌ Code utilise 10 (ligne 84)
    obvTrend: 20,       // ✅ Cohérent avec code (ligne 130)
    divergence: 10      // ❌ Code utilise 20 (ligne 137)
};
```

**Impact:** La configuration centralisée ne sert à rien si le code ne l'utilise pas!

**Actions:**
1. **Option A:** Modifier le code pour utiliser la config (recommandé)
2. **Option B:** Modifier la config pour refléter le code actuel (si valeurs actuelles sont optimales)

### 2. PatternDetector.js - Aucune Config Utilisée

**Problème:** Ce fichier ne fait AUCUNE référence à `lookbackPeriods.js` et contient 14+ magic numbers.

**Impact:**
- Impossible d'optimiser les patterns sans modifier le code
- Patterns de détection ne peuvent pas être testés avec différents paramètres
- Maintenance complexe et risque d'incohérences

---

## 🎯 Plan de Refactoring Recommandé

### Phase 1: Corrections Critiques (Priorité HAUTE)

#### 1.1 StatisticalContextService.js - PSAR Bar Count
```javascript
// Ligne 429
// AVANT
bars: 50,

// APRÈS
import { getBarCount } from '../config/barCounts.js';
bars: getBarCount('indicator', timeframe),
```

#### 1.2 VolumeEnricher.js - Résoudre Incohérences
**Décision requise:** Quelle valeur est correcte?

**Option A - Utiliser la config actuelle:**
```javascript
// Ligne 84: Changer de 10 → 3
const recentBars = this._analyzeRecentVolumeBars(bars.slice(-VOLUME_PERIODS.recentBars));

// Ligne 137: Changer de 20 → 10
const divergence = this._detectOBVDivergence(obvValues.slice(-VOLUME_PERIODS.divergence), prices);
```

**Option B - Ajuster la config:**
```javascript
// lookbackPeriods.js
export const VOLUME_PERIODS = {
    average: 20,
    recentBars: 10,      // Changé de 3 → 10
    obvTrend: 20,
    divergence: 20       // Changé de 10 → 20
};
```

**Recommandation:** Option A (utiliser la config) car 3 recent bars et 10 divergence sont plus cohérents avec la théorie technique.

---

### Phase 2: Refactoring Systématique (Priorité MOYENNE)

#### 2.1 Ajouter les Imports Nécessaires

Tous les enrichers doivent importer:
```javascript
import {
    STATISTICAL_PERIODS,
    TREND_PERIODS,
    PATTERN_PERIODS,
    VOLUME_PERIODS,
    SUPPORT_RESISTANCE_PERIODS
} from '../../config/lookbackPeriods.js';
```

#### 2.2 Remplacer Tous les slice() Hardcodés

**Pattern de remplacement:**
```javascript
// AVANT
const trend = this._detectTrend(values.slice(-10));
const percentile = this._getPercentile(current, values.slice(-50));

// APRÈS
const trend = this._detectTrend(values.slice(-TREND_PERIODS.short));
const percentile = this._getPercentile(current, values.slice(-STATISTICAL_PERIODS.medium));
```

#### 2.3 Fichiers à Traiter (Ordre de Priorité)

1. ✅ **MomentumEnricher.js** - 10 instances, pattern clair
2. ✅ **VolatilityEnricher.js** - 5 instances, pattern clair
3. ✅ **PriceActionEnricher.js** - 6 instances
4. ✅ **MovingAveragesEnricher.js** - 3 instances
5. ⚠️ **StatisticalContextService.js** - 4 instances lookback

---

### Phase 3: PatternDetector.js - Refactoring Complet (Priorité HAUTE mais COMPLEXE)

#### 3.1 Ajouter Nouveaux Paramètres à lookbackPeriods.js

```javascript
// Ajouter dans config/lookbackPeriods.js
export const PATTERN_PERIODS = {
    swingLookback: 30,
    structureLookback: 80,
    microPattern: 10,
    recentAction: 3,

    // NOUVEAUX paramètres pour PatternDetector
    minimumBars: 30,           // Minimum bars requis pour pattern detection
    range24h: 24,              // 24-hour range analysis

    // Flag pattern parameters
    poleMinLength: 15,         // Minimum pole length for flag
    poleSearchStart: 15,       // Where to start looking for pole
    poleSearchEnd: 8,          // Where to end pole search
    flagMinLength: 5,          // Minimum flag duration
    flagMaxLength: 15,         // Maximum flag duration

    // Swing detection parameters
    triangleSwingBars: 60,     // Bars for triangle swing detection
    wedgeSwingBars: 60,        // Bars for wedge swing detection
    headShouldersSwingBars: 80, // Bars for H&S pattern
    doublePatternBars: 50      // Bars for double top/bottom
};

// ATR multipliers pour swing detection
export const PATTERN_ATR_MULTIPLIERS = {
    normalSwing: 1.3,          // Standard swing detection
    significantSwing: 1.5      // Significant pattern swings
};
```

#### 3.2 Refactorer PatternDetector.js

**Exemple de refactoring (lignes 169-186):**
```javascript
// AVANT
const recent = bars.slice(-30);
// ... logic ...
const poleEnd = recent.findIndex((bar, i) => {
    if (i < 15) return false;  // HARDCODED
    // ...
});

// Look back further for pole start
for (let i = poleEnd - 15; i >= poleEnd - 8; i--) {  // HARDCODED
    // ...
}

if (flag.length < 5 || flag.length > 15) {  // HARDCODED
    // ...
}

// APRÈS
const recent = bars.slice(-PATTERN_PERIODS.swingLookback);
// ... logic ...
const poleEnd = recent.findIndex((bar, i) => {
    if (i < PATTERN_PERIODS.poleMinLength) return false;
    // ...
});

// Look back further for pole start
for (let i = poleEnd - PATTERN_PERIODS.poleSearchStart;
     i >= poleEnd - PATTERN_PERIODS.poleSearchEnd; i--) {
    // ...
}

if (flag.length < PATTERN_PERIODS.flagMinLength ||
    flag.length > PATTERN_PERIODS.flagMaxLength) {
    // ...
}
```

---

## 🔬 Impact du Refactoring

### Avant Refactoring
```javascript
// Code fragmenté, non optimisable
const trend = this._detectTrend(values.slice(-10));
const percentile = this._getPercentile(current, values.slice(-50));
const divergence = this._detectDivergence(values.slice(-20), prices);
```

**Problèmes:**
- ❌ Impossible de tester avec lookback de 15, 25, 60 sans modifier le code
- ❌ Incohérences entre fichiers (un utilise 10, l'autre 15)
- ❌ Difficile à maintenir (changement nécessite modification dans 10+ endroits)

### Après Refactoring
```javascript
// Importé une seule fois
import { TREND_PERIODS, STATISTICAL_PERIODS } from '../config/lookbackPeriods.js';

// Code centralisé, optimisable
const trend = this._detectTrend(values.slice(-TREND_PERIODS.short));
const percentile = this._getPercentile(current, values.slice(-STATISTICAL_PERIODS.medium));
const divergence = this._detectDivergence(
    values.slice(-TREND_PERIODS.medium),
    prices.slice(-TREND_PERIODS.medium)
);
```

**Avantages:**
- ✅ Modification d'un seul paramètre dans config affecte tout le système
- ✅ Backtesting peut tester différentes valeurs facilement
- ✅ Cohérence garantie à travers le codebase
- ✅ Auto-documentation (noms explicites vs magic numbers)

### Pour le Backtesting

**Avant:** Pour tester différents lookback periods
```javascript
// Nécessite modification de 48+ endroits dans le code!
// Risque d'oublier certains
// Impossible à automatiser
```

**Après:** Configuration centralisée
```javascript
// config/lookbackPeriods.js
export const STATISTICAL_PERIODS = {
    short: process.env.STAT_SHORT || 20,
    medium: process.env.STAT_MEDIUM || 50,
    long: process.env.STAT_LONG || 90
};

// Backtesting script
for (let shortPeriod = 10; shortPeriod <= 30; shortPeriod += 5) {
    process.env.STAT_SHORT = shortPeriod;
    // Run backtest with this configuration
}
```

---

## 📝 Checklist de Refactoring

### Étape 1: Préparation
- [ ] Créer branche `refactor/centralize-lookback-periods`
- [ ] Ajouter nouveaux paramètres pattern-specific dans `lookbackPeriods.js`
- [ ] Écrire tests de non-régression pour chaque enricher

### Étape 2: Corrections Critiques
- [ ] StatisticalContextService.js ligne 429 (PSAR bars)
- [ ] Résoudre incohérences VolumeEnricher.js (lignes 84, 137)

### Étape 3: Enrichers Simples (Pattern Clair)
- [ ] VolatilityEnricher.js (5 instances)
- [ ] MovingAveragesEnricher.js (3 instances)
- [ ] MomentumEnricher.js (10 instances)
- [ ] VolumeEnricher.js (4 instances restantes après corrections)
- [ ] PriceActionEnricher.js (6 instances)

### Étape 4: StatisticalContextService.js
- [ ] Ligne 85 (trend detection)
- [ ] Ligne 93 (anomaly detection)
- [ ] Ligne 460 (price action)
- [ ] Ligne 471 (support/resistance)

### Étape 5: PatternDetector.js (Le Plus Complexe)
- [ ] Ajouter tous les nouveaux paramètres pattern-specific
- [ ] Refactorer flag pattern detection (lignes 169-200)
- [ ] Refactorer triangle detection (ligne 229)
- [ ] Refactorer wedge detection (ligne 287)
- [ ] Refactorer H&S detection (ligne 328)
- [ ] Refactorer double patterns (ligne 365)
- [ ] Ajouter PATTERN_ATR_MULTIPLIERS config

### Étape 6: Validation
- [ ] Exécuter tous les tests
- [ ] Valider avec script de validation
- [ ] Comparer résultats avant/après refactoring
- [ ] Vérifier qu'aucun hardcoded value ne reste

### Étape 7: Documentation
- [ ] Mettre à jour CONFIGURABLE_PARAMETERS.md
- [ ] Ajouter guide d'optimisation des lookback periods
- [ ] Documenter les nouveaux paramètres pattern-specific

---

## 🚀 Prochaines Étapes Recommandées

### Option A: Refactoring Complet (Recommandé)
**Effort:** 4-6 heures
**Bénéfice:** Système entièrement configurable et optimisable

1. Ajouter nouveaux paramètres à `lookbackPeriods.js`
2. Refactorer tous les enrichers (phases 2-5)
3. Valider avec tests automatisés
4. Documenter nouveaux paramètres

### Option B: Corrections Critiques Uniquement
**Effort:** 30 minutes
**Bénéfice:** Résout les incohérences les plus graves

1. Fixer PSAR bar count (StatisticalContextService:429)
2. Fixer incohérences VolumeEnricher (lignes 84, 137)
3. Valider avec tests

### Option C: Approche Incrémentale
**Effort:** 1-2 heures par phase
**Bénéfice:** Progrès visible, risque réduit

1. **Semaine 1:** Corrections critiques + VolatilityEnricher
2. **Semaine 2:** MomentumEnricher + MovingAveragesEnricher
3. **Semaine 3:** VolumeEnricher + PriceActionEnricher
4. **Semaine 4:** StatisticalContextService
5. **Semaine 5:** PatternDetector (le plus complexe)

---

## 📊 Métriques de Succès

**Avant Refactoring:**
- Magic numbers hardcodés: **48+**
- Fichiers avec hardcoded values: **7**
- Configuration centralisée utilisée: **~30%** (seulement bar counts OHLCV/indicator)

**Après Refactoring (Objectif):**
- Magic numbers hardcodés: **0**
- Fichiers avec hardcoded values: **0** (sauf config files)
- Configuration centralisée utilisée: **100%**
- Paramètres configurables pour backtesting: **60+** (32 actuels + 28+ nouveaux)

---

## ✅ Conclusion

Le projet a fait un excellent premier pas en créant les configurations centralisées `barCounts.js` et `lookbackPeriods.js`, mais **le code n'utilise pas encore ces configurations**.

**État actuel:**
- ✅ Configuration centralisée existe
- ❌ Code utilise encore 48+ magic numbers hardcodés
- ⚠️ Incohérences entre config et code (VolumeEnricher)

**Impact pour le backtesting:**
- ❌ Impossible d'optimiser facilement les lookback periods
- ❌ Tests nécessitent modifications du code source
- ❌ Risque d'incohérences entre différentes stratégies

**Recommandation finale:** Procéder avec **Option A (Refactoring Complet)** ou **Option C (Approche Incrémentale)** pour réaliser pleinement les bénéfices de la centralisation des paramètres.
