// Generic indicator rendering functions

// Color palette for different indicator lines
const INDICATOR_COLORS = ['#2196F3', '#FF9800', '#9C27B0', '#4CAF50', '#F44336', '#00BCD4', '#FF5722'];
let colorIndex = 0;

function getNextColor() {
    const color = INDICATOR_COLORS[colorIndex];
    colorIndex = (colorIndex + 1) % INDICATOR_COLORS.length;
    return color;
}

// Add overlay indicator to main chart
function addOverlayIndicator(name, series) {
    // Handle multi-line indicators (Bollinger Bands, Ichimoku, etc.)
    if (series.length > 1) {
        series.forEach((s, idx) => {
            const color = INDICATOR_COLORS[idx % INDICATOR_COLORS.length];
            const lineSeries = mainChart.addLineSeries({
                color: color,
                lineWidth: idx === 1 ? 2 : 1, // Middle line thicker
                title: `${name.toUpperCase()}-${s.name}`,
            });
            lineSeries.setData(s.data);
            const seriesKey = `${name}-${s.name}-overlay`;
            indicatorSeries.set(seriesKey, lineSeries);
        });
    } else if (series.length === 1 && series[0].data) {
        // Single line indicator
        const color = getNextColor();
        const lineSeries = mainChart.addLineSeries({
            color: color,
            lineWidth: 2,
            title: name.toUpperCase(),
        });
        lineSeries.setData(series[0].data);
        const seriesKey = `${name}-overlay`;
        indicatorSeries.set(seriesKey, lineSeries);
    }
}

// Add oscillator indicator to indicator chart
function addOscillatorIndicator(name, series) {
    document.getElementById('indicatorChartWrapper').style.display = 'block';

    // Special handling for MACD (has histogram component)
    if (name === 'macd') {
        const macdData = series.find(s => s.name === 'macd')?.data;
        const signalData = series.find(s => s.name === 'macdSignal')?.data;
        const histogramData = series.find(s => s.name === 'macdHistogram')?.data;

        if (macdData) {
            const color = '#2196F3';
            const macdLine = indicatorChart.addLineSeries({ color: color, lineWidth: 2 });
            macdLine.setData(macdData);
            const seriesKey = `${name}-macd-oscillator`;
            indicatorSeries.set(seriesKey, macdLine);
        }

        if (signalData) {
            const color = '#FF9800';
            const signalLine = indicatorChart.addLineSeries({ color: color, lineWidth: 2 });
            signalLine.setData(signalData);
            const seriesKey = `${name}-signal-oscillator`;
            indicatorSeries.set(seriesKey, signalLine);
        }

        if (histogramData) {
            const histogram = indicatorChart.addHistogramSeries({
                color: '#26a69a',
                priceFormat: { type: 'price', precision: 4 },
            });
            histogram.setData(histogramData.map(point => ({
                ...point,
                color: point.value >= 0 ? '#26a69a' : '#ef5350',
            })));
            indicatorSeries.set(`${name}-histogram-oscillator`, histogram);
            // Note: Histogram doesn't have a legend item as color changes per bar
        }
        return;
    }

    // Special handling for Stochastic (has %K and %D lines)
    if (name === 'stochastic' || name === 'stochRsi') {
        series.forEach((s, idx) => {
            const color = INDICATOR_COLORS[idx % INDICATOR_COLORS.length];
            const lineSeries = indicatorChart.addLineSeries({
                color: color,
                lineWidth: 2,
            });
            lineSeries.setData(s.data);
            const seriesKey = `${name}-${s.name}-oscillator`;
            indicatorSeries.set(seriesKey, lineSeries);
        });

        // Add reference lines for stochastic (20, 80)
        if (series[0] && series[0].data.length > 0) {
            const times = series[0].data.map(s => s.time);
            const upperLine = indicatorChart.addLineSeries({
                color: '#666',
                lineWidth: 1,
                lineStyle: LightweightCharts.LineStyle.Dashed,
            });
            const lowerLine = indicatorChart.addLineSeries({
                color: '#666',
                lineWidth: 1,
                lineStyle: LightweightCharts.LineStyle.Dashed,
            });

            upperLine.setData(times.map(time => ({ time, value: 80 })));
            lowerLine.setData(times.map(time => ({ time, value: 20 })));

            indicatorSeries.set(`${name}-upper-ref`, upperLine);
            indicatorSeries.set(`${name}-lower-ref`, lowerLine);
        }
        return;
    }

    // Special handling for RSI (needs reference lines)
    if (name === 'rsi') {
        if (series[0] && series[0].data) {
            const color = '#9C27B0';
            const rsiLine = indicatorChart.addLineSeries({
                color: color,
                lineWidth: 2,
            });
            rsiLine.setData(series[0].data);
            const seriesKey = `${name}-oscillator`;
            indicatorSeries.set(seriesKey, rsiLine);

            // Add RSI reference lines (30, 70)
            const times = series[0].data.map(s => s.time);
            const upperLine = indicatorChart.addLineSeries({
                color: '#666',
                lineWidth: 1,
                lineStyle: LightweightCharts.LineStyle.Dashed,
            });
            const lowerLine = indicatorChart.addLineSeries({
                color: '#666',
                lineWidth: 1,
                lineStyle: LightweightCharts.LineStyle.Dashed,
            });

            upperLine.setData(times.map(time => ({ time, value: 70 })));
            lowerLine.setData(times.map(time => ({ time, value: 30 })));

            indicatorSeries.set(`${name}-upper-ref`, upperLine);
            indicatorSeries.set(`${name}-lower-ref`, lowerLine);
        }
        return;
    }

    // Generic oscillator handling (single or multiple lines)
    series.forEach((s, idx) => {
        if (!s.data || s.data.length === 0) return;

        const color = INDICATOR_COLORS[idx % INDICATOR_COLORS.length];
        const lineSeries = indicatorChart.addLineSeries({
            color: color,
            lineWidth: 2,
            title: `${name.toUpperCase()}${series.length > 1 ? `-${s.name}` : ''}`,
        });
        lineSeries.setData(s.data);
        const seriesKey = `${name}-${s.name || 'line'}-oscillator`;
        indicatorSeries.set(seriesKey, lineSeries);
    });

    // Update oscillator title
    updateOscillatorTitle();
}

function updateOscillatorTitle() {
    const oscillatorNames = Array.from(indicatorSeries.keys())
        .filter(k => k.includes('oscillator') && !k.includes('ref') && !k.includes('signal') && !k.includes('histogram'))
        .map(k => k.split('-')[0].toUpperCase())
        .filter((v, i, a) => a.indexOf(v) === i); // unique

    document.getElementById('indicatorTitle').textContent = oscillatorNames.length > 0
        ? `Indicateurs: ${oscillatorNames.join(', ')}`
        : 'Indicateurs';
}
