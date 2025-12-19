// Chart legend management - displays indicator badges on top of charts

// Track indicator metadata for legend
const indicatorMetadata = new Map(); // key: seriesKey, value: { name, color, isOverlay, visible }

// Add legend badge for an indicator
function addChartLegend(indicatorName, seriesKey, color, isOverlay) {
    const legendContainer = isOverlay
        ? document.getElementById('mainChartLegend')
        : document.getElementById('indicatorChartLegend');

    // Store metadata
    indicatorMetadata.set(seriesKey, {
        name: indicatorName,
        color: color,
        isOverlay: isOverlay,
        visible: true
    });

    // Check if badge already exists
    let badge = document.getElementById(`badge-${seriesKey}`);
    if (badge) return; // Already exists

    // Create badge
    badge = document.createElement('div');
    badge.className = 'legend-badge';
    badge.id = `badge-${seriesKey}`;

    // Color indicator
    const colorBox = document.createElement('div');
    colorBox.className = 'legend-badge-color';
    colorBox.style.backgroundColor = color;
    colorBox.id = `color-${seriesKey}`;

    // Name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'legend-badge-name';
    nameSpan.textContent = indicatorName.toUpperCase();

    // Controls container
    const controls = document.createElement('div');
    controls.className = 'legend-badge-controls';

    // Visibility toggle button
    const visibilityBtn = document.createElement('button');
    visibilityBtn.className = 'legend-badge-btn';
    visibilityBtn.innerHTML = '👁';
    visibilityBtn.title = 'Masquer/Afficher';
    visibilityBtn.dataset.seriesKey = seriesKey;
    visibilityBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLegendVisibility(seriesKey, badge, visibilityBtn);
    });

    // Color picker button
    const colorBtn = document.createElement('button');
    colorBtn.className = 'legend-badge-btn';
    colorBtn.innerHTML = '🎨';
    colorBtn.title = 'Changer la couleur';
    colorBtn.dataset.seriesKey = seriesKey;
    colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showLegendColorPicker(seriesKey, colorBtn, colorBox);
    });

    // Assemble badge
    controls.appendChild(visibilityBtn);
    controls.appendChild(colorBtn);

    badge.appendChild(colorBox);
    badge.appendChild(nameSpan);
    badge.appendChild(controls);

    legendContainer.appendChild(badge);
}

// Remove legend badge
function removeChartLegend(seriesKey) {
    const badge = document.getElementById(`badge-${seriesKey}`);
    if (badge) 
        badge.remove();
    
    indicatorMetadata.delete(seriesKey);
}

// Toggle visibility using native series.applyOptions()
function toggleLegendVisibility(seriesKey, badge, btn) {
    const metadata = indicatorMetadata.get(seriesKey);
    if (!metadata) return;

    const series = indicatorSeries.get(seriesKey);
    if (!series || !series.applyOptions) return;

    // Toggle visibility
    const newVisibility = !metadata.visible;
    series.applyOptions({ visible: newVisibility });

    // Update metadata
    metadata.visible = newVisibility;
    indicatorMetadata.set(seriesKey, metadata);

    // Update UI
    if (newVisibility) {
        badge.classList.remove('hidden');
        btn.innerHTML = '👁';
    } else {
        badge.classList.add('hidden');
        btn.innerHTML = '👁‍🗨';
    }
}

// Show color picker and change color using native series.applyOptions()
function showLegendColorPicker(seriesKey, btn, colorBox) {
    const metadata = indicatorMetadata.get(seriesKey);
    if (!metadata) return;

    const series = indicatorSeries.get(seriesKey);
    if (!series || !series.applyOptions) return;

    // Available colors
    const colors = ['#2196F3', '#FF9800', '#9C27B0', '#4CAF50', '#F44336', '#00BCD4', '#FF5722', '#FFEB3B', '#E91E63'];

    // Create color picker popup
    const picker = document.createElement('div');
    picker.className = 'color-picker-popup';
    picker.style.position = 'fixed';
    picker.style.zIndex = '1000';
    picker.style.background = '#2a2a2a';
    picker.style.border = '1px solid #444';
    picker.style.borderRadius = '4px';
    picker.style.padding = '8px';
    picker.style.display = 'grid';
    picker.style.gridTemplateColumns = 'repeat(3, 1fr)';
    picker.style.gap = '6px';
    picker.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';

    // Position near the button
    const rect = btn.getBoundingClientRect();
    picker.style.top = `${rect.bottom + 5}px`;
    picker.style.left = `${rect.left}px`;

    // Add color options
    colors.forEach(color => {
        const colorOption = document.createElement('div');
        colorOption.style.width = '24px';
        colorOption.style.height = '24px';
        colorOption.style.backgroundColor = color;
        colorOption.style.borderRadius = '3px';
        colorOption.style.cursor = 'pointer';
        colorOption.style.border = '2px solid transparent';
        colorOption.style.transition = 'all 0.2s';

        colorOption.addEventListener('mouseenter', () => {
            colorOption.style.borderColor = '#fff';
            colorOption.style.transform = 'scale(1.1)';
        });

        colorOption.addEventListener('mouseleave', () => {
            colorOption.style.borderColor = 'transparent';
            colorOption.style.transform = 'scale(1)';
        });

        colorOption.addEventListener('click', () => {
            // Change color using native applyOptions
            series.applyOptions({ color: color });

            // Update metadata and UI
            metadata.color = color;
            indicatorMetadata.set(seriesKey, metadata);
            colorBox.style.backgroundColor = color;

            // Close picker
            document.body.removeChild(picker);
        });

        picker.appendChild(colorOption);
    });

    // Close picker when clicking outside
    const closeHandler = (e) => {
        if (!picker.contains(e.target) && e.target !== btn) {
            if (document.body.contains(picker)) 
                document.body.removeChild(picker);
            
            document.removeEventListener('click', closeHandler);
        }
    };

    setTimeout(() => {
        document.addEventListener('click', closeHandler);
    }, 0);

    document.body.appendChild(picker);
}
