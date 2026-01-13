/**
 * Tab Manager
 * Manages switching between Charts and Backtesting tabs
 */

document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = {
        charts: document.getElementById('chartsTab'),
        backtest: document.getElementById('backtestTab')
    };

    // Sidebar elements that should only show on charts tab
    const chartsOnlyElements = {
        search: document.getElementById('searchContainer'),
        selectedIndicators: document.getElementById('selectedIndicatorsSection'),
        sidebarContent: document.getElementById('sidebarContent'),
        indicatorStats: document.getElementById('indicatorStatsContainer'),
        clearAllBtn: document.getElementById('clearAllBtn')
    };

    // Function to switch tabs
    function switchTab(tabName) {
        // Update tab buttons
        tabButtons.forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update tab content
        Object.keys(tabContents).forEach(key => {
            if (key === tabName) {
                tabContents[key].classList.add('active');
            } else {
                tabContents[key].classList.remove('active');
            }
        });

        // Show/hide sidebar elements based on active tab
        if (tabName === 'charts') {
            // Show charts-specific sidebar elements
            Object.values(chartsOnlyElements).forEach(el => {
                if (el) el.style.display = '';
            });
        } else {
            // Hide charts-specific sidebar elements for backtest tab
            chartsOnlyElements.search.style.display = 'none';
            chartsOnlyElements.selectedIndicators.style.display = 'none';
            chartsOnlyElements.sidebarContent.style.display = 'none';
            chartsOnlyElements.indicatorStats.style.display = 'none';
            chartsOnlyElements.clearAllBtn.style.display = 'none';
        }

        // Save active tab to localStorage
        localStorage.setItem('activeTab', tabName);
    }

    // Add click listeners to tab buttons
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });

    // Restore last active tab from localStorage
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab && tabContents[savedTab]) {
        switchTab(savedTab);
    } else {
        // Default to charts tab
        switchTab('charts');
    }

    // Initialize backtest dates when switching to backtest tab
    const backtestTabBtn = document.querySelector('[data-tab="backtest"]');
    backtestTabBtn.addEventListener('click', () => {
        // Initialize dates if not already set
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');

        if (!startDateInput.value && !endDateInput.value) {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30); // 30 days ago

            endDateInput.valueAsDate = endDate;
            startDateInput.valueAsDate = startDate;
        }
    });
});
