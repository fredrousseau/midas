#!/usr/bin/env node
/**
 * Backtest Runner Script
 *
 * Usage:
 *   node scripts/run-backtest.js --symbol BTCUSDT --start 2024-01-01 --end 2024-12-31 --timeframe 1h
 *
 * Options:
 *   --symbol      Trading symbol (default: BTCUSDT)
 *   --start       Start date YYYY-MM-DD (default: 30 days ago)
 *   --end         End date YYYY-MM-DD (default: today)
 *   --timeframe   Timeframe (default: 1h)
 *   --confidence  Minimum confidence (default: 0.6)
 *   --quality     Minimum quality score (default: 60)
 *   --output      Output file for results (optional)
 */

import { BacktestingService } from '../src/Trading/Backtesting/BacktestingService.js';
import { writeFile } from 'fs/promises';

// ANSI colors
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const blue = '\x1b[34m';
const cyan = '\x1b[36m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

// Parse command line arguments
function parseArgs() {
	const args = process.argv.slice(2);
	const params = {
		symbol: 'BTCUSDT',
		start: null,
		end: null,
		timeframe: '1h',
		minConfidence: 0.6,
		minQualityScore: 60,
		output: null
	};

	for (let i = 0; i < args.length; i += 2) {
		const key = args[i].replace('--', '');
		const value = args[i + 1];

		switch (key) {
			case 'symbol':
				params.symbol = value;
				break;
			case 'start':
				params.start = new Date(value);
				break;
			case 'end':
				params.end = new Date(value);
				break;
			case 'timeframe':
				params.timeframe = value;
				break;
			case 'confidence':
				params.minConfidence = parseFloat(value);
				break;
			case 'quality':
				params.minQualityScore = parseInt(value);
				break;
			case 'output':
				params.output = value;
				break;
		}
	}

	// Default dates if not provided
	if (!params.start) {
		params.start = new Date();
		params.start.setDate(params.start.getDate() - 30); // 30 days ago
	}

	if (!params.end) {
		params.end = new Date(); // Today
	}

	return params;
}

// Format performance metrics for display
function formatPerformance(performance) {
	const { win_rate, total_pnl_percent, profit_factor, sharpe_ratio, max_drawdown, buy_and_hold_pnl_percent, strategy_vs_hold } = performance;

	console.log(`\n${blue}${bold}PERFORMANCE METRICS${reset}`);
	console.log('━'.repeat(70));

	// Win rate
	const winRateColor = win_rate >= 60 ? green : win_rate >= 40 ? yellow : red;
	console.log(`  Win Rate:              ${winRateColor}${win_rate.toFixed(2)}%${reset}`);

	// Total P&L
	const pnlColor = total_pnl_percent > 0 ? green : red;
	console.log(`  Total P&L:             ${pnlColor}${total_pnl_percent > 0 ? '+' : ''}${total_pnl_percent.toFixed(2)}%${reset}`);

	// Profit factor
	const pfColor = profit_factor >= 2 ? green : profit_factor >= 1 ? yellow : red;
	console.log(`  Profit Factor:         ${pfColor}${profit_factor.toFixed(2)}${reset}`);

	// Sharpe ratio
	const sharpeColor = sharpe_ratio >= 1 ? green : sharpe_ratio >= 0 ? yellow : red;
	console.log(`  Sharpe Ratio:          ${sharpeColor}${sharpe_ratio.toFixed(2)}${reset}`);

	// Max drawdown
	const ddColor = max_drawdown <= 10 ? green : max_drawdown <= 20 ? yellow : red;
	console.log(`  Max Drawdown:          ${ddColor}-${max_drawdown.toFixed(2)}%${reset}`);

	// Buy & Hold comparison
	console.log(`\n  ${bold}Strategy vs Buy & Hold:${reset}`);
	console.log(`    Strategy P&L:        ${pnlColor}${total_pnl_percent > 0 ? '+' : ''}${total_pnl_percent.toFixed(2)}%${reset}`);
	const holdColor = buy_and_hold_pnl_percent > 0 ? green : red;
	console.log(`    Buy & Hold P&L:      ${holdColor}${buy_and_hold_pnl_percent > 0 ? '+' : ''}${buy_and_hold_pnl_percent.toFixed(2)}%${reset}`);
	const diffColor = strategy_vs_hold > 0 ? green : red;
	console.log(`    Difference:          ${diffColor}${strategy_vs_hold > 0 ? '+' : ''}${strategy_vs_hold.toFixed(2)}%${reset}`);

	console.log('━'.repeat(70));
}

// Format trade summary
function formatTradeSummary(trades) {
	if (trades.length === 0) {
		console.log(`\n${yellow}No trades executed during backtest period${reset}`);
		return;
	}

	console.log(`\n${blue}${bold}TRADE BREAKDOWN${reset}`);
	console.log('━'.repeat(70));

	console.log(`\n  Total Trades: ${trades.length}`);

	// Show last 5 trades
	const recentTrades = trades.slice(-5);
	console.log(`\n  ${bold}Last 5 Trades:${reset}\n`);

	for (const trade of recentTrades) {
		const pnlColor = trade.result === 'WIN' ? green : red;
		const resultIcon = trade.result === 'WIN' ? '✅' : '❌';

		console.log(`  ${resultIcon} ${trade.direction} @ ${trade.entry_price.toFixed(2)}`);
		console.log(`     Entry:  ${new Date(trade.entry_time).toLocaleString()}`);
		console.log(`     Exit:   ${new Date(trade.exit_time).toLocaleString()}`);
		console.log(`     P&L:    ${pnlColor}${trade.pnl_percent > 0 ? '+' : ''}${trade.pnl_percent.toFixed(2)}%${reset}`);
		console.log(`     Reason: ${trade.exit_reason}`);
		console.log('');
	}

	console.log('━'.repeat(70));
}

// Display header
function displayHeader(params) {
	console.log(`\n${blue}${'═'.repeat(70)}${reset}`);
	console.log(`${blue}${bold}  MIDAS BACKTESTING ENGINE${reset}`);
	console.log(`${blue}${'═'.repeat(70)}${reset}\n`);

	console.log(`  Symbol:        ${cyan}${params.symbol}${reset}`);
	console.log(`  Timeframe:     ${cyan}${params.timeframe}${reset}`);
	console.log(`  Period:        ${cyan}${params.start.toLocaleDateString()} → ${params.end.toLocaleDateString()}${reset}`);
	console.log(`  Min Confidence: ${cyan}${(params.minConfidence * 100).toFixed(0)}%${reset}`);
	console.log(`  Min Quality:    ${cyan}${params.minQualityScore}${reset}\n`);
	console.log(`${blue}${'═'.repeat(70)}${reset}\n`);
}

// Main execution
async function main() {
	try {
		const params = parseArgs();

		displayHeader(params);

		// Note: You need to provide your own marketDataService and indicatorService
		// This is a demonstration of how to use the BacktestingService

		console.log(`${yellow}⚠️  Note: This script requires marketDataService and indicatorService${reset}`);
		console.log(`${yellow}   Please integrate with your data provider (e.g., Binance, database)${reset}\n`);

		// Example usage (commented out - needs real services):
		/*
		const backtestingService = new BacktestingService({
			logger: console,
			marketDataService: yourMarketDataService,
			indicatorService: yourIndicatorService
		});

		console.log(`${cyan}Starting backtest...${reset}\n`);

		const results = await backtestingService.runBacktest({
			symbol: params.symbol,
			startDate: params.start,
			endDate: params.end,
			timeframe: params.timeframe,
			strategy: {
				minConfidence: params.minConfidence,
				minQualityScore: params.minQualityScore
			}
		});

		// Display results
		formatPerformance(results.performance);
		formatTradeSummary(results.trades);

		// Save to file if requested
		if (params.output) {
			await writeFile(params.output, JSON.stringify(results, null, 2));
			console.log(`\n${green}✅ Results saved to ${params.output}${reset}\n`);
		}

		// Summary
		console.log(`\n${blue}${bold}SUMMARY${reset}`);
		console.log('━'.repeat(70));
		console.log(`  Candles Analyzed:  ${results.summary.candles_analyzed}`);
		console.log(`  Signals Generated: ${results.summary.signals_generated}`);
		console.log(`  Trades Executed:   ${results.summary.trades_executed}`);
		console.log(`  Win Rate:          ${results.performance.win_rate.toFixed(2)}%`);
		console.log(`  Total P&L:         ${results.performance.total_pnl_percent > 0 ? '+' : ''}${results.performance.total_pnl_percent.toFixed(2)}%`);
		console.log('━'.repeat(70));
		console.log('');
		*/

		// Example output format
		console.log(`${green}${bold}Example Output Format:${reset}\n`);

		const exampleResults = {
			summary: {
				symbol: params.symbol,
				timeframe: params.timeframe,
				period: {
					start: params.start,
					end: params.end,
					duration_days: Math.ceil((params.end - params.start) / (1000 * 60 * 60 * 24))
				},
				candles_analyzed: 720,
				signals_generated: 45,
				trades_executed: 12
			},
			performance: {
				total_trades: 12,
				winning_trades: 8,
				losing_trades: 4,
				win_rate: 66.67,
				total_pnl_percent: 15.3,
				profit_factor: 2.1,
				sharpe_ratio: 1.4,
				max_drawdown: 8.5,
				buy_and_hold_pnl_percent: 10.2,
				strategy_vs_hold: 5.1
			},
			trades: [
				{
					entry_time: new Date('2024-01-15T10:00:00Z'),
					entry_price: 45000,
					exit_time: new Date('2024-01-17T14:00:00Z'),
					exit_price: 46800,
					direction: 'LONG',
					pnl_percent: 4.0,
					result: 'WIN',
					exit_reason: 'take_profit'
				}
			]
		};

		formatPerformance(exampleResults.performance);
		formatTradeSummary(exampleResults.trades);

		console.log(`\n${cyan}To run with real data, integrate your market data service and uncomment the code.${reset}\n`);

	} catch (error) {
		console.error(`${red}${bold}ERROR:${reset} ${error.message}`);
		if (error.stack) {
			console.error(`\n${red}${error.stack}${reset}`);
		}
		process.exit(1);
	}
}

main();
