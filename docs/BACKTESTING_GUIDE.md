# Guide de Backtesting - MIDAS

Guide complet pour utiliser le système de backtesting et optimiser les paramètres de trading.

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Installation et Configuration](#installation-et-configuration)
3. [Utilisation Basique](#utilisation-basique)
4. [Architecture du Backtesting](#architecture-du-backtesting)
5. [Optimisation des Paramètres](#optimisation-des-paramètres)
6. [Métriques de Performance](#métriques-de-performance)
7. [Exemples Pratiques](#exemples-pratiques)
8. [Interprétation des Résultats](#interprétation-des-résultats)

---

## Vue d'ensemble

Le système de backtesting MIDAS permet de:

- ✅ **Rejouer l'historique** - Analyser chaque chandelier d'une période
- ✅ **Générer des signaux** - Détecter automatiquement les points d'entrée/sortie
- ✅ **Calculer les performances** - Win rate, P&L, Sharpe ratio, drawdown, etc.
- ✅ **Optimiser les paramètres** - Tester différentes configurations
- ✅ **Comparer aux stratégies** - Buy & Hold, autres stratégies
- ✅ **Exporter les résultats** - JSON, CSV pour analyse externe

---

## Installation et Configuration

### Prérequis

```bash
# Node.js v20.x requis
node -v  # Doit afficher v20.x.x

# Dépendances installées
npm install
```

### Structure des Fichiers

```
Midas/
├── src/Trading/Backtesting/
│   └── BacktestingService.js       # Service principal
├── scripts/
│   └── run-backtest.js             # Script d'exécution
└── docs/
    └── BACKTESTING_GUIDE.md        # Ce guide
```

---

## Utilisation Basique

### 1. Exécuter un Backtest Simple

```bash
# Backtest sur 30 derniers jours (par défaut)
node scripts/run-backtest.js

# Backtest sur une période spécifique
node scripts/run-backtest.js \
  --symbol BTCUSDT \
  --start 2024-01-01 \
  --end 2024-12-31 \
  --timeframe 1h

# Avec filtres de qualité
node scripts/run-backtest.js \
  --symbol ETHUSDT \
  --start 2024-06-01 \
  --end 2024-12-01 \
  --timeframe 4h \
  --confidence 0.7 \
  --quality 70
```

### 2. Options Disponibles

| Option | Description | Défaut | Exemple |
|--------|-------------|--------|---------|
| `--symbol` | Symbole de trading | BTCUSDT | ETHUSDT, BNBUSDT |
| `--start` | Date de début | 30 jours avant | 2024-01-01 |
| `--end` | Date de fin | Aujourd'hui | 2024-12-31 |
| `--timeframe` | Timeframe d'analyse | 1h | 5m, 15m, 1h, 4h, 1d |
| `--confidence` | Confiance minimale | 0.6 | 0.5, 0.7, 0.8 |
| `--quality` | Score qualité min | 60 | 50, 70, 80 |
| `--output` | Fichier de sortie | - | results.json |

### 3. Exemple de Sortie

```
═══════════════════════════════════════════════════════════════════
  MIDAS BACKTESTING ENGINE
═══════════════════════════════════════════════════════════════════

  Symbol:         BTCUSDT
  Timeframe:      1h
  Period:         1/1/2024 → 31/12/2024
  Min Confidence: 60%
  Min Quality:    60

═══════════════════════════════════════════════════════════════════

PERFORMANCE METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Win Rate:              66.67%
  Total P&L:             +15.30%
  Profit Factor:         2.10
  Sharpe Ratio:          1.40
  Max Drawdown:          -8.50%

  Strategy vs Buy & Hold:
    Strategy P&L:        +15.30%
    Buy & Hold P&L:      +10.20%
    Difference:          +5.10%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRADE BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Total Trades: 12

  Last 5 Trades:

  ✅ LONG @ 45000.00
     Entry:  1/15/2024, 10:00:00 AM
     Exit:   1/17/2024, 2:00:00 PM
     P&L:    +4.00%
     Reason: take_profit

  ...
```

---

## Architecture du Backtesting

### Flux d'Exécution

```
1. Récupération des Données Historiques
   ↓
2. Pour Chaque Chandelier:
   ├── Générer l'analyse complète (MarketAnalysisService)
   ├── Extraire le contexte de trading (TradingContextService)
   ├── Détecter les signaux (Entry/Exit)
   └── Stocker les résultats
   ↓
3. Simulation des Trades
   ├── Ouvrir les positions sur ENTRY
   ├── Fermer sur EXIT, Stop Loss ou Take Profit
   └── Calculer P&L par trade
   ↓
4. Calcul des Métriques de Performance
   ├── Win Rate, Total P&L
   ├── Profit Factor, Sharpe Ratio
   ├── Max Drawdown
   └── Comparaison Buy & Hold
   ↓
5. Génération du Rapport
```

### Services Utilisés

```javascript
BacktestingService
  ↓ utilise
MarketAnalysisService
  ↓ utilise
├── StatisticalContextService
│   └── Tous les enrichers (Momentum, Volatility, etc.)
├── RegimeDetectionService
└── TradingContextService (génère les signaux)
```

### Données Générées

Pour chaque chandelier analysé:

```javascript
{
  timestamp: Date,
  price: number,
  analysis: {
    market_phase: string,           // "uptrend", "downtrend", "ranging"
    recommended_action: string,     // "LONG", "SHORT", "WAIT", "AVOID"
    confidence: number,             // 0.0 - 1.0
    trade_quality_score: {
      total: number,                // 0 - 100
      momentum: number,
      structure: number,
      risk_reward: number
    }
  },
  signal: {                         // Si signal détecté
    type: "ENTRY" | "EXIT",
    direction: "LONG" | "SHORT",
    price: number,
    stop_loss: number,
    take_profit: number,
    confidence: number,
    quality_score: number
  }
}
```

---

## Optimisation des Paramètres

### 1. Tests de Sensibilité

Tester l'impact d'un seul paramètre:

```bash
# Test avec différentes valeurs de STATISTICAL_PERIODS.short
for period in 15 20 25 30; do
  # Modifier lookbackPeriods.js
  # STATISTICAL_PERIODS.short = $period

  node scripts/run-backtest.js \
    --symbol BTCUSDT \
    --start 2024-01-01 \
    --end 2024-12-31 \
    --output "results_short_${period}.json"
done

# Comparer les résultats
```

### 2. Grid Search (Recherche Exhaustive)

```javascript
// Exemple de script d'optimisation
import { BacktestingService } from './src/Trading/Backtesting/BacktestingService.js';
import * as lookbackPeriods from './src/Trading/MarketAnalysis/config/lookbackPeriods.js';

async function gridSearch() {
  const results = [];

  // Paramètres à tester
  const shortPeriods = [15, 20, 25, 30];
  const mediumPeriods = [40, 50, 60, 70];

  for (const short of shortPeriods) {
    for (const medium of mediumPeriods) {
      // Modifier temporairement les paramètres
      lookbackPeriods.STATISTICAL_PERIODS.short = short;
      lookbackPeriods.STATISTICAL_PERIODS.medium = medium;

      // Exécuter backtest
      const result = await backtestingService.runBacktest({
        symbol: 'BTCUSDT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        timeframe: '1h'
      });

      results.push({
        params: { short, medium },
        performance: result.performance
      });
    }
  }

  // Trouver la meilleure configuration
  const best = results.reduce((max, r) =>
    r.performance.total_pnl_percent > max.performance.total_pnl_percent ? r : max
  );

  console.log('Best configuration:', best);
}
```

### 3. Walk-Forward Analysis

Test sur périodes glissantes pour éviter l'overfitting:

```javascript
// Période 1: Optimisation (In-Sample)
// 2024-01-01 → 2024-06-30
const optimizationPeriod = await runBacktest({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-06-30')
});

// Période 2: Validation (Out-of-Sample)
// 2024-07-01 → 2024-12-31
const validationPeriod = await runBacktest({
  startDate: new Date('2024-07-01'),
  endDate: new Date('2024-12-31')
});

// Les performances doivent être similaires
if (Math.abs(optimizationPeriod.total_pnl_percent - validationPeriod.total_pnl_percent) < 5) {
  console.log('✅ Paramètres robustes (pas d\'overfitting)');
} else {
  console.log('⚠️ Possible overfitting détecté');
}
```

### 4. Paramètres Prioritaires à Optimiser

Basé sur [CONFIGURABLE_PARAMETERS.md](CONFIGURABLE_PARAMETERS.md#12-lookback-periods):

#### 🔴 HAUTE PRIORITÉ

1. **STATISTICAL_PERIODS.short** (20)
   - Range: 15-30
   - Impact: Détection de tendance court terme
   - Test: [15, 17, 20, 23, 25, 28, 30]

2. **STATISTICAL_PERIODS.medium** (50)
   - Range: 40-70
   - Impact: Contexte moyen terme, percentiles
   - Test: [40, 45, 50, 55, 60, 65, 70]

3. **TREND_PERIODS.short** (10)
   - Range: 7-15
   - Impact: Détection de divergences
   - Test: [7, 9, 10, 12, 15]

4. **TREND_PERIODS.medium** (20)
   - Range: 15-30
   - Impact: Tendances multi-timeframe
   - Test: [15, 18, 20, 25, 30]

5. **VOLUME_PERIODS.average** (20)
   - Range: 15-30
   - Impact: Filtrage volume anormal
   - Test: [15, 18, 20, 25, 30]

6. **PATTERN_ATR_MULTIPLIERS.normalSwing** (1.3)
   - Range: 1.0-1.7
   - Impact: Détection de swings
   - Test: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7]

#### 🟡 MOYENNE PRIORITÉ

7. **STATISTICAL_PERIODS.long** (90)
   - Range: 60-120
   - Impact: Détection d'anomalies
   - Test: [60, 75, 90, 105, 120]

8. **SUPPORT_RESISTANCE_PERIODS.lookback** (50)
   - Range: 40-80
   - Impact: Identification S/R
   - Test: [40, 50, 60, 70, 80]

---

## Métriques de Performance

### Métriques Clés

#### 1. Win Rate (Taux de Réussite)
```
Win Rate = (Trades Gagnants / Total Trades) × 100
```

**Interprétation:**
- ✅ Excellent: ≥ 60%
- 🟡 Bon: 40-60%
- ❌ Faible: < 40%

**Note:** Un win rate de 50% peut être profitable si profit factor > 1

#### 2. Total P&L (Profit & Loss)
```
Total P&L % = Σ(PnL par trade en %)
```

**Interprétation:**
- ✅ Excellent: > 20% sur 1 an
- 🟡 Bon: 10-20% sur 1 an
- ❌ Faible: < 10% sur 1 an

#### 3. Profit Factor
```
Profit Factor = Gains Moyens / Pertes Moyennes
```

**Interprétation:**
- ✅ Excellent: ≥ 2.0
- 🟡 Bon: 1.5-2.0
- 🟢 Acceptable: 1.0-1.5
- ❌ Mauvais: < 1.0

#### 4. Sharpe Ratio
```
Sharpe Ratio = (Rendement Moyen) / (Écart-Type des Rendements)
```

**Interprétation:**
- ✅ Excellent: > 2.0
- 🟡 Bon: 1.0-2.0
- 🟢 Acceptable: 0.5-1.0
- ❌ Mauvais: < 0.5

#### 5. Maximum Drawdown
```
Max Drawdown = Max(Peak - Trough) pendant la période
```

**Interprétation:**
- ✅ Excellent: < 10%
- 🟡 Bon: 10-20%
- 🟢 Acceptable: 20-30%
- ❌ Risqué: > 30%

#### 6. Strategy vs Buy & Hold
```
Différence = Total P&L Stratégie - Buy & Hold P&L
```

**Interprétation:**
- ✅ Valeur ajoutée: Différence > 0
- ❌ Pas de valeur: Différence ≤ 0

---

## Exemples Pratiques

### Exemple 1: Backtest Simple

```javascript
import { BacktestingService } from './src/Trading/Backtesting/BacktestingService.js';

const backtestingService = new BacktestingService({
  logger: console,
  marketDataService: yourMarketDataService,
  indicatorService: yourIndicatorService
});

const results = await backtestingService.runBacktest({
  symbol: 'BTCUSDT',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  timeframe: '1h'
});

console.log('Performance:', results.performance);
console.log('Trades:', results.trades.length);
```

### Exemple 2: Backtest avec Stratégie Stricte

```javascript
const results = await backtestingService.runBacktest({
  symbol: 'ETHUSDT',
  startDate: new Date('2024-06-01'),
  endDate: new Date('2024-12-01'),
  timeframe: '4h',
  strategy: {
    minConfidence: 0.75,      // 75% minimum
    minQualityScore: 75       // Score qualité 75+
  }
});

// Moins de trades, mais meilleure qualité
```

### Exemple 3: Comparaison Multi-Timeframes

```javascript
const timeframes = ['1h', '4h', '1d'];
const results = [];

for (const tf of timeframes) {
  const result = await backtestingService.runBacktest({
    symbol: 'BTCUSDT',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    timeframe: tf
  });

  results.push({
    timeframe: tf,
    win_rate: result.performance.win_rate,
    total_pnl: result.performance.total_pnl_percent,
    trades: result.trades.length
  });
}

console.table(results);
```

### Exemple 4: Export et Analyse

```javascript
import { writeFile } from 'fs/promises';

const results = await backtestingService.runBacktest({...});

// Sauvegarder les résultats complets
await writeFile('backtest_results.json', JSON.stringify(results, null, 2));

// Exporter juste les trades pour Excel
const tradesCSV = results.trades.map(t => ({
  entry_time: t.entry_time,
  exit_time: t.exit_time,
  direction: t.direction,
  entry_price: t.entry_price,
  exit_price: t.exit_price,
  pnl_percent: t.pnl_percent,
  result: t.result
}));

await writeFile('trades.json', JSON.stringify(tradesCSV, null, 2));
```

---

## Interprétation des Résultats

### Bon Backtest vs Mauvais Backtest

#### ✅ Bon Backtest (Stratégie Prometteuse)

```
Win Rate:              65%
Total P&L:             +18.5%
Profit Factor:         2.3
Sharpe Ratio:          1.6
Max Drawdown:          -12%
Strategy vs Hold:      +8.2%
```

**Pourquoi c'est bon:**
- Win rate > 60%
- Profit factor > 2 (gains 2.3x plus élevés que pertes)
- Sharpe ratio > 1 (bon ratio rendement/risque)
- Drawdown acceptable (< 15%)
- Bat le Buy & Hold de +8.2%

#### ❌ Mauvais Backtest (Stratégie à Éviter)

```
Win Rate:              35%
Total P&L:             -5.2%
Profit Factor:         0.7
Sharpe Ratio:          -0.3
Max Drawdown:          -35%
Strategy vs Hold:      -15.4%
```

**Pourquoi c'est mauvais:**
- Win rate < 40%
- Profit factor < 1 (pertes > gains)
- Sharpe ratio négatif
- Drawdown trop élevé (> 30%)
- Perd contre Buy & Hold de -15.4%

### Signaux d'Overfitting

⚠️ **Attention si:**

1. **Performance trop parfaite**
   - Win rate > 80%
   - Drawdown < 3%
   - Probablement trop optimisé sur l'historique

2. **Différence In-Sample vs Out-of-Sample**
   - Performance chute de >20% sur données non vues
   - Stratégie non généralisable

3. **Trop peu de trades**
   - < 30 trades sur 1 an
   - Pas assez de données statistiques

4. **Trop de paramètres optimisés**
   - > 5 paramètres ajustés finement
   - Risque de curve-fitting

### Actions Recommandées

#### Si Performance Excellente
1. ✅ Valider sur autre période (walk-forward)
2. ✅ Tester sur autre symbole
3. ✅ Tester avec plus de conservatisme (min confidence +10%)
4. ✅ Commencer trading papier

#### Si Performance Moyenne
1. 🟡 Optimiser 2-3 paramètres prioritaires
2. 🟡 Tester timeframes différents
3. 🟡 Ajuster filtres de qualité
4. 🟡 Analyser trades perdants

#### Si Performance Mauvaise
1. ❌ Revoir stratégie fondamentale
2. ❌ Vérifier données (erreurs?)
3. ❌ Tester marché différent (trending vs ranging)
4. ❌ Ne PAS trader avec argent réel

---

## Prochaines Étapes

1. **Intégrer vos données** - Connecter à Binance, base de données, etc.
2. **Exécuter premier backtest** - Commencer simple (30 jours, 1h)
3. **Analyser résultats** - Identifier forces et faiblesses
4. **Optimiser** - Tester 2-3 paramètres prioritaires
5. **Valider** - Walk-forward, autres symboles
6. **Trading papier** - Tester en temps réel sans risque
7. **Production** - Déployer avec capital limité

---

## Support et Documentation

- **Tests fonctionnels:** [scripts/README_TESTS.md](../scripts/README_TESTS.md)
- **Paramètres:** [CONFIGURABLE_PARAMETERS.md](CONFIGURABLE_PARAMETERS.md)
- **Rapport validation:** [TEST_REPORT.md](TEST_REPORT.md)

---

**Dernière mise à jour:** 2026-01-12
**Version:** 1.0.0
**Statut:** 🚀 Production-Ready
