// Global variables
let map;
let marker;
let gridSquare;
let selectedLat = null;
let selectedLon = null;
let charts = {};
let comparisonEnabled = false;
let comparisonYear = null;

// GEFS grid resolution (0.25 degrees)
const GEFS_GRID_RESOLUTION = 0.25;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeDatePickers();
    setupEventListeners();

    // Set Big Sky, Montana as default location
    // Coordinates: 45.2615°N, 111.3081°W
    setTimeout(() => {
        selectLocation(45.2615, -111.3081);
        map.setView([45.2615, -111.3081], 9);
    }, 500);
});

// Initialize Leaflet map
function initializeMap() {
    // Create map centered on US
    map = L.map('map').setView([39.8283, -98.5795], 4);

    // Add terrain tiles with topography
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
        maxZoom: 17
    }).addTo(map);

    // Add click event to map
    map.on('click', function(e) {
        const { lat, lng } = e.latlng;
        selectLocation(lat, lng);
    });
}

// Snap coordinates to GEFS grid
function snapToGrid(lat, lon) {
    const snappedLat = Math.round(lat / GEFS_GRID_RESOLUTION) * GEFS_GRID_RESOLUTION;
    const snappedLon = Math.round(lon / GEFS_GRID_RESOLUTION) * GEFS_GRID_RESOLUTION;
    return { lat: snappedLat, lon: snappedLon };
}

// Get grid cell bounds
function getGridBounds(centerLat, centerLon) {
    const halfGrid = GEFS_GRID_RESOLUTION / 2;
    return [
        [centerLat - halfGrid, centerLon - halfGrid],
        [centerLat + halfGrid, centerLon + halfGrid]
    ];
}

// Select location on map
function selectLocation(lat, lon) {
    // Snap to GEFS grid
    const snapped = snapToGrid(lat, lon);
    selectedLat = snapped.lat;
    selectedLon = snapped.lon;

    // Remove existing marker and grid square if any
    if (marker) {
        map.removeLayer(marker);
    }
    if (gridSquare) {
        map.removeLayer(gridSquare);
    }

    // Add GEFS grid square
    const bounds = getGridBounds(selectedLat, selectedLon);
    gridSquare = L.rectangle(bounds, {
        color: '#667eea',
        weight: 2,
        fillColor: '#667eea',
        fillOpacity: 0.2
    }).addTo(map);

    // Add marker at grid center
    marker = L.marker([selectedLat, selectedLon]).addTo(map);
    marker.bindPopup(
        `<b>GEFS Grid Point</b><br>` +
        `Center: ${selectedLat.toFixed(2)}°, ${selectedLon.toFixed(2)}°<br>` +
        `Resolution: ${GEFS_GRID_RESOLUTION}°<br>` +
        `<small>Clicked: ${lat.toFixed(4)}°, ${lon.toFixed(4)}°</small>`
    ).openPopup();

    // Update info display
    document.getElementById('location-info').textContent = `Grid Point: ${selectedLat.toFixed(2)}°, ${selectedLon.toFixed(2)}°`;
    document.getElementById('coords-info').textContent = `${selectedLat.toFixed(2)}°, ${selectedLon.toFixed(2)}° (GEFS Grid)`;

    // Reverse geocoding to get location name
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${selectedLat}&lon=${selectedLon}`)
        .then(response => response.json())
        .then(data => {
            const locationName = data.display_name || 'Unknown location';
            document.getElementById('location-info').textContent = locationName;
        })
        .catch(error => {
            console.error('Geocoding error:', error);
        });
}

// Initialize date pickers
function initializeDatePickers() {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));

    flatpickr("#start-date", {
        defaultDate: thirtyDaysAgo,
        maxDate: today,
        dateFormat: "Y-m-d",
        onChange: updateComparisonYearOptions
    });

    flatpickr("#end-date", {
        defaultDate: today,
        maxDate: today,
        dateFormat: "Y-m-d",
        onChange: updateComparisonYearOptions
    });

    // Initialize comparison year dropdown
    updateComparisonYearOptions();
}

// Update comparison year dropdown based on selected dates
function updateComparisonYearOptions() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const yearSelect = document.getElementById('comparison-year');

    if (!startDate || !endDate) return;

    const currentYear = new Date(endDate).getFullYear();
    yearSelect.innerHTML = '<option value="">Select year...</option>';

    // Add years from 2000 to one year before current selection
    for (let year = currentYear - 1; year >= 2000; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('fetch-data').addEventListener('click', fetchWeatherData);

    document.getElementById('enable-comparison').addEventListener('change', (e) => {
        comparisonEnabled = e.target.checked;
        document.getElementById('comparison-year').disabled = !comparisonEnabled;
        if (!comparisonEnabled) {
            document.getElementById('comparison-year').value = '';
            comparisonYear = null;
        }
    });

    document.getElementById('comparison-year').addEventListener('change', (e) => {
        comparisonYear = e.target.value ? parseInt(e.target.value) : null;
    });
}

// Fetch weather data from Open-Meteo API
async function fetchWeatherData() {
    if (!selectedLat || !selectedLon) {
        showError('Please select a location on the map first!');
        return;
    }

    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (!startDate || !endDate) {
        showError('Please select both start and end dates!');
        return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        showError('Start date must be before end date!');
        return;
    }

    if (comparisonEnabled && !comparisonYear) {
        showError('Please select a comparison year!');
        return;
    }

    showLoading(true);
    hideError();

    try {
        // Fetch primary data
        const url = `https://archive-api.open-meteo.com/v1/archive?` +
            `latitude=${selectedLat}&longitude=${selectedLon}` +
            `&start_date=${startDate}&end_date=${endDate}` +
            `&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,` +
            `precipitation_sum,rain_sum,snowfall_sum,` +
            `windspeed_10m_max,windgusts_10m_max,winddirection_10m_dominant,` +
            `shortwave_radiation_sum,` +
            `relative_humidity_2m_mean,surface_pressure_mean,` +
            `cloudcover_mean,` +
            `precipitation_hours` +
            `&timezone=auto`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.daily) {
            throw new Error('No data available for the selected location and time range');
        }

        let comparisonData = null;

        // Fetch comparison data if enabled
        if (comparisonEnabled && comparisonYear) {
            const yearDiff = new Date(startDate).getFullYear() - comparisonYear;
            const compStartDate = new Date(startDate);
            compStartDate.setFullYear(compStartDate.getFullYear() - yearDiff);
            const compEndDate = new Date(endDate);
            compEndDate.setFullYear(compEndDate.getFullYear() - yearDiff);

            const compUrl = `https://archive-api.open-meteo.com/v1/archive?` +
                `latitude=${selectedLat}&longitude=${selectedLon}` +
                `&start_date=${compStartDate.toISOString().split('T')[0]}&end_date=${compEndDate.toISOString().split('T')[0]}` +
                `&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,` +
                `precipitation_sum,rain_sum,snowfall_sum,` +
                `windspeed_10m_max,windgusts_10m_max,winddirection_10m_dominant,` +
                `shortwave_radiation_sum,` +
                `relative_humidity_2m_mean,surface_pressure_mean,` +
                `cloudcover_mean,` +
                `precipitation_hours` +
                `&timezone=auto`;

            const compResponse = await fetch(compUrl);
            if (compResponse.ok) {
                comparisonData = await compResponse.json();
            }
        }

        // Show charts container first to ensure proper sizing
        document.getElementById('charts').style.display = 'block';

        // Render charts after a brief delay to ensure container is visible and sized
        requestAnimationFrame(() => {
            setTimeout(() => {
                renderCharts(data, comparisonData);
                renderPrecipSnowPlumes(data, comparisonData);
            }, 100);
        });

    } catch (error) {
        console.error('Error fetching weather data:', error);
        showError(`Failed to fetch weather data: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Render all charts
function renderCharts(data, comparisonData = null) {
    // Destroy existing charts
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });

    const dates = data.daily.time;
    const primaryYear = new Date(dates[0]).getFullYear();
    const comparisonYear = comparisonData ? new Date(comparisonData.daily.time[0]).getFullYear() : null;

    // Check if mobile for smaller fonts
    const isMobile = window.innerWidth <= 768;
    const fontSize = isMobile ? 9 : 12;
    const titleSize = isMobile ? 11 : 14;

    // Common scale configuration
    const getXScale = () => ({
        ticks: {
            font: { size: fontSize },
            maxRotation: 45,
            minRotation: 45
        }
    });

    const getYScale = (title, beginAtZero = false) => ({
        beginAtZero,
        ticks: {
            font: { size: fontSize }
        },
        title: {
            display: true,
            text: title,
            font: { size: titleSize }
        }
    });

    const getLegendConfig = () => ({
        position: 'top',
        labels: {
            font: { size: fontSize },
            padding: isMobile ? 8 : 10
        }
    });

    const getDualYScale = (title1, title2, max1 = null) => ({
        x: getXScale(),
        y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            max: max1,
            ticks: {
                font: { size: fontSize }
            },
            title: {
                display: true,
                text: title1,
                font: { size: titleSize }
            }
        },
        y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            grid: {
                drawOnChartArea: false
            },
            ticks: {
                font: { size: fontSize }
            },
            title: {
                display: true,
                text: title2,
                font: { size: titleSize }
            }
        }
    });

    // Temperature Chart
    const tempDatasets = [
        {
            label: `Max Temperature ${primaryYear} (°C)`,
            data: data.daily.temperature_2m_max,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            tension: 0.4,
            fill: true
        },
        {
            label: `Mean Temperature ${primaryYear} (°C)`,
            data: data.daily.temperature_2m_mean,
            borderColor: 'rgb(255, 159, 64)',
            backgroundColor: 'rgba(255, 159, 64, 0.1)',
            tension: 0.4,
            fill: true
        },
        {
            label: `Min Temperature ${primaryYear} (°C)`,
            data: data.daily.temperature_2m_min,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            tension: 0.4,
            fill: true
        }
    ];

    if (comparisonData) {
        tempDatasets.push(
            {
                label: `Max Temperature ${comparisonYear} (°C)`,
                data: comparisonData.daily.temperature_2m_max,
                borderColor: 'rgb(255, 140, 0)',
                backgroundColor: 'rgba(255, 140, 0, 0.1)',
                borderDash: [5, 5],
                tension: 0.4,
                fill: true
            },
            {
                label: `Mean Temperature ${comparisonYear} (°C)`,
                data: comparisonData.daily.temperature_2m_mean,
                borderColor: 'rgb(218, 165, 32)',
                backgroundColor: 'rgba(218, 165, 32, 0.1)',
                borderDash: [5, 5],
                tension: 0.4,
                fill: true
            },
            {
                label: `Min Temperature ${comparisonYear} (°C)`,
                data: comparisonData.daily.temperature_2m_min,
                borderColor: 'rgb(34, 139, 34)',
                backgroundColor: 'rgba(34, 139, 34, 0.1)',
                borderDash: [5, 5],
                tension: 0.4,
                fill: true
            }
        );
    }

    charts.temperature = new Chart(document.getElementById('temp-chart'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: tempDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: getLegendConfig()
            },
            scales: {
                x: getXScale(),
                y: getYScale('Temperature (°C)', false)
            }
        }
    });

    // Precipitation Chart
    const precipDatasets = [
        {
            label: `Total Precipitation ${primaryYear} (mm)`,
            data: data.daily.precipitation_sum,
            backgroundColor: 'rgba(54, 162, 235, 0.7)',
            borderColor: 'rgb(54, 162, 235)',
            borderWidth: 1
        },
        {
            label: `Rain ${primaryYear} (mm)`,
            data: data.daily.rain_sum,
            backgroundColor: 'rgba(75, 192, 192, 0.7)',
            borderColor: 'rgb(75, 192, 192)',
            borderWidth: 1
        },
        {
            label: `Snowfall ${primaryYear} (cm)`,
            data: data.daily.snowfall_sum,
            backgroundColor: 'rgba(201, 203, 207, 0.7)',
            borderColor: 'rgb(201, 203, 207)',
            borderWidth: 1
        }
    ];

    if (comparisonData) {
        precipDatasets.push(
            {
                label: `Total Precipitation ${comparisonYear} (mm)`,
                data: comparisonData.daily.precipitation_sum,
                backgroundColor: 'rgba(255, 140, 0, 0.7)',
                borderColor: 'rgb(255, 140, 0)',
                borderWidth: 1
            },
            {
                label: `Rain ${comparisonYear} (mm)`,
                data: comparisonData.daily.rain_sum,
                backgroundColor: 'rgba(218, 165, 32, 0.7)',
                borderColor: 'rgb(218, 165, 32)',
                borderWidth: 1
            },
            {
                label: `Snowfall ${comparisonYear} (cm)`,
                data: comparisonData.daily.snowfall_sum,
                backgroundColor: 'rgba(138, 43, 226, 0.7)',
                borderColor: 'rgb(138, 43, 226)',
                borderWidth: 1
            }
        );
    }

    charts.precipitation = new Chart(document.getElementById('precip-chart'), {
        type: 'bar',
        data: {
            labels: dates,
            datasets: precipDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: getLegendConfig()
            },
            scales: {
                x: getXScale(),
                y: getYScale('Precipitation (mm/cm)', true)
            }
        }
    });

    // Wind Chart
    const windDatasets = [
        {
            label: `Max Wind Speed ${primaryYear} (km/h)`,
            data: data.daily.windspeed_10m_max,
            borderColor: 'rgb(153, 102, 255)',
            backgroundColor: 'rgba(153, 102, 255, 0.1)',
            tension: 0.4,
            fill: true,
            yAxisID: 'y'
        },
        {
            label: `Wind Gusts ${primaryYear} (km/h)`,
            data: data.daily.windgusts_10m_max,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            tension: 0.4,
            fill: true,
            yAxisID: 'y'
        }
    ];

    if (comparisonData) {
        windDatasets.push(
            {
                label: `Max Wind Speed ${comparisonYear} (km/h)`,
                data: comparisonData.daily.windspeed_10m_max,
                borderColor: 'rgb(255, 140, 0)',
                backgroundColor: 'rgba(255, 140, 0, 0.1)',
                borderDash: [5, 5],
                tension: 0.4,
                fill: true,
                yAxisID: 'y'
            },
            {
                label: `Wind Gusts ${comparisonYear} (km/h)`,
                data: comparisonData.daily.windgusts_10m_max,
                borderColor: 'rgb(218, 165, 32)',
                backgroundColor: 'rgba(218, 165, 32, 0.1)',
                borderDash: [5, 5],
                tension: 0.4,
                fill: true,
                yAxisID: 'y'
            }
        );
    }

    charts.wind = new Chart(document.getElementById('wind-chart'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: windDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: getLegendConfig()
            },
            scales: {
                x: getXScale(),
                y: getYScale('Wind Speed (km/h)', true)
            }
        }
    });

    // Solar Radiation Chart
    const solarDatasets = [
        {
            label: `Shortwave Radiation ${primaryYear} (MJ/m²)`,
            data: data.daily.shortwave_radiation_sum,
            backgroundColor: 'rgba(255, 206, 86, 0.7)',
            borderColor: 'rgb(255, 206, 86)',
            borderWidth: 1
        }
    ];

    if (comparisonData) {
        solarDatasets.push({
            label: `Shortwave Radiation ${comparisonYear} (MJ/m²)`,
            data: comparisonData.daily.shortwave_radiation_sum,
            backgroundColor: 'rgba(255, 140, 0, 0.7)',
            borderColor: 'rgb(255, 140, 0)',
            borderWidth: 1
        });
    }

    charts.solar = new Chart(document.getElementById('solar-chart'), {
        type: 'bar',
        data: {
            labels: dates,
            datasets: solarDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: getLegendConfig()
            },
            scales: {
                x: getXScale(),
                y: getYScale('Solar Radiation (MJ/m²)', true)
            }
        }
    });

    // Humidity & Pressure Chart
    const humidityDatasets = [
        {
            label: `Relative Humidity ${primaryYear} (%)`,
            data: data.daily.relative_humidity_2m_mean,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            tension: 0.4,
            fill: true,
            yAxisID: 'y'
        },
        {
            label: `Surface Pressure ${primaryYear} (hPa)`,
            data: data.daily.surface_pressure_mean,
            borderColor: 'rgb(153, 102, 255)',
            backgroundColor: 'rgba(153, 102, 255, 0.1)',
            tension: 0.4,
            fill: true,
            yAxisID: 'y1'
        }
    ];

    if (comparisonData) {
        humidityDatasets.push(
            {
                label: `Relative Humidity ${comparisonYear} (%)`,
                data: comparisonData.daily.relative_humidity_2m_mean,
                borderColor: 'rgb(255, 140, 0)',
                backgroundColor: 'rgba(255, 140, 0, 0.1)',
                borderDash: [5, 5],
                tension: 0.4,
                fill: true,
                yAxisID: 'y'
            },
            {
                label: `Surface Pressure ${comparisonYear} (hPa)`,
                data: comparisonData.daily.surface_pressure_mean,
                borderColor: 'rgb(218, 165, 32)',
                backgroundColor: 'rgba(218, 165, 32, 0.1)',
                borderDash: [5, 5],
                tension: 0.4,
                fill: true,
                yAxisID: 'y1'
            }
        );
    }

    charts.humidity = new Chart(document.getElementById('humidity-chart'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: humidityDatasets
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: getLegendConfig()
            },
            scales: getDualYScale("Humidity (%)", "Pressure (hPa)", 100)
        }
    });

    // Cloud Cover Chart
    const cloudDatasets = [
        {
            label: `Cloud Cover ${primaryYear} (%)`,
            data: data.daily.cloudcover_mean,
            borderColor: 'rgb(201, 203, 207)',
            backgroundColor: 'rgba(201, 203, 207, 0.3)',
            tension: 0.4,
            fill: true,
            yAxisID: 'y'
        },
        {
            label: `Precipitation Hours ${primaryYear}`,
            data: data.daily.precipitation_hours,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.3)',
            tension: 0.4,
            fill: true,
            yAxisID: 'y1'
        }
    ];

    if (comparisonData) {
        cloudDatasets.push(
            {
                label: `Cloud Cover ${comparisonYear} (%)`,
                data: comparisonData.daily.cloudcover_mean,
                borderColor: 'rgb(255, 140, 0)',
                backgroundColor: 'rgba(255, 140, 0, 0.3)',
                borderDash: [5, 5],
                tension: 0.4,
                fill: true,
                yAxisID: 'y'
            },
            {
                label: `Precipitation Hours ${comparisonYear}`,
                data: comparisonData.daily.precipitation_hours,
                borderColor: 'rgb(218, 165, 32)',
                backgroundColor: 'rgba(218, 165, 32, 0.3)',
                borderDash: [5, 5],
                tension: 0.4,
                fill: true,
                yAxisID: 'y1'
            }
        );
    }

    charts.cloud = new Chart(document.getElementById('cloud-chart'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: cloudDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: getLegendConfig()
            },
            scales: getDualYScale('Cloud Cover (%)', 'Precipitation Hours', 100)
        }
    });
}

// Show loading indicator
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.add('active');
    } else {
        loading.classList.remove('active');
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.classList.add('active');
}

// Hide error message
function hideError() {
    const errorDiv = document.getElementById('error');
    errorDiv.classList.remove('active');
}

// Render precipitation and snow plume-style charts from historical data
function renderPrecipSnowPlumes(data, comparisonData = null) {
    document.getElementById('ensemble-charts').style.display = 'block';

    const isMobile = window.innerWidth <= 768;
    const fontSize = isMobile ? 9 : 12;
    const titleSize = isMobile ? 11 : 14;

    const dates = data.daily.time;
    const primaryYear = new Date(dates[0]).getFullYear();
    const comparisonYear = comparisonData ? new Date(comparisonData.daily.time[0]).getFullYear() : null;

    // Calculate cumulative totals for primary data
    let precipCumulative = [];
    let snowCumulative = [];
    let precipSum = 0;
    let snowSum = 0;

    data.daily.precipitation_sum.forEach(val => {
        precipSum += val || 0;
        precipCumulative.push(precipSum);
    });

    data.daily.snowfall_sum.forEach(val => {
        snowSum += val || 0;
        snowCumulative.push(snowSum);
    });

    // Calculate cumulative totals for comparison data
    let compPrecipCumulative = [];
    let compSnowCumulative = [];
    let compPrecipSum = 0;
    let compSnowSum = 0;

    if (comparisonData) {
        comparisonData.daily.precipitation_sum.forEach(val => {
            compPrecipSum += val || 0;
            compPrecipCumulative.push(compPrecipSum);
        });

        comparisonData.daily.snowfall_sum.forEach(val => {
            compSnowSum += val || 0;
            compSnowCumulative.push(compSnowSum);
        });
    }

    // Precipitation Plume Chart (showing total, rain, and snow as range)
    if (charts.precipPlume) charts.precipPlume.destroy();

    const precipPlumeDatasets = [
        {
            label: `Total Precipitation ${primaryYear}`,
            data: data.daily.precipitation_sum,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.3)',
            borderWidth: 3,
            pointRadius: 2,
            fill: false
        },
        {
            label: `Rain ${primaryYear}`,
            data: data.daily.rain_sum,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderWidth: 2,
            pointRadius: 1,
            fill: 'origin'
        }
    ];

    if (comparisonData) {
        precipPlumeDatasets.push(
            {
                label: `Total Precipitation ${comparisonYear}`,
                data: comparisonData.daily.precipitation_sum,
                borderColor: 'rgb(255, 140, 0)',
                backgroundColor: 'rgba(255, 140, 0, 0.3)',
                borderDash: [5, 5],
                borderWidth: 3,
                pointRadius: 2,
                fill: false
            },
            {
                label: `Rain ${comparisonYear}`,
                data: comparisonData.daily.rain_sum,
                borderColor: 'rgb(218, 165, 32)',
                backgroundColor: 'rgba(218, 165, 32, 0.2)',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 1,
                fill: 'origin'
            }
        );
    }

    charts.precipPlume = new Chart(document.getElementById('precip-plume-chart'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: precipPlumeDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { size: fontSize }
                    }
                },
                title: {
                    display: true,
                    text: 'Daily Precipitation',
                    font: { size: titleSize }
                }
            },
            scales: {
                x: {
                    ticks: {
                        font: { size: fontSize },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: { size: fontSize }
                    },
                    title: {
                        display: true,
                        text: 'Daily Precipitation (mm)',
                        font: { size: titleSize }
                    }
                }
            }
        }
    });

    // Snow Plume Chart
    if (charts.snowPlume) charts.snowPlume.destroy();

    const snowPlumeDatasets = [
        {
            label: `Snowfall ${primaryYear}`,
            data: data.daily.snowfall_sum,
            borderColor: 'rgb(100, 150, 200)',
            backgroundColor: 'rgba(100, 150, 200, 0.3)',
            borderWidth: 3,
            pointRadius: 2,
            fill: 'origin'
        }
    ];

    if (comparisonData) {
        snowPlumeDatasets.push({
            label: `Snowfall ${comparisonYear}`,
            data: comparisonData.daily.snowfall_sum,
            borderColor: 'rgb(138, 43, 226)',
            backgroundColor: 'rgba(138, 43, 226, 0.3)',
            borderDash: [5, 5],
            borderWidth: 3,
            pointRadius: 2,
            fill: 'origin'
        });
    }

    charts.snowPlume = new Chart(document.getElementById('snow-plume-chart'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: snowPlumeDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { size: fontSize }
                    }
                },
                title: {
                    display: true,
                    text: 'Daily Snowfall',
                    font: { size: titleSize }
                }
            },
            scales: {
                x: {
                    ticks: {
                        font: { size: fontSize },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: { size: fontSize }
                    },
                    title: {
                        display: true,
                        text: 'Daily Snowfall (cm)',
                        font: { size: titleSize }
                    }
                }
            }
        }
    });

    // Precipitation Cumulative Total Chart
    if (charts.precipTotal) charts.precipTotal.destroy();

    const precipTotalDatasets = [
        {
            label: `Cumulative Precipitation ${primaryYear}`,
            data: precipCumulative,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderWidth: 3,
            pointRadius: 2,
            fill: 'origin'
        }
    ];

    if (comparisonData) {
        precipTotalDatasets.push({
            label: `Cumulative Precipitation ${comparisonYear}`,
            data: compPrecipCumulative,
            borderColor: 'rgb(255, 140, 0)',
            backgroundColor: 'rgba(255, 140, 0, 0.2)',
            borderDash: [5, 5],
            borderWidth: 3,
            pointRadius: 2,
            fill: 'origin'
        });
    }

    const precipTotalTitle = comparisonData
        ? `Total Precipitation: ${primaryYear} = ${precipSum.toFixed(1)} mm | ${comparisonYear} = ${compPrecipSum.toFixed(1)} mm`
        : `Total Precipitation: ${precipSum.toFixed(1)} mm`;

    charts.precipTotal = new Chart(document.getElementById('precip-total-chart'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: precipTotalDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { size: fontSize }
                    }
                },
                title: {
                    display: true,
                    text: precipTotalTitle,
                    font: { size: titleSize }
                }
            },
            scales: {
                x: {
                    ticks: {
                        font: { size: fontSize },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: { size: fontSize }
                    },
                    title: {
                        display: true,
                        text: 'Cumulative Precipitation (mm)',
                        font: { size: titleSize }
                    }
                }
            }
        }
    });

    // Snow Cumulative Total Chart
    if (charts.snowTotal) charts.snowTotal.destroy();

    const snowTotalDatasets = [
        {
            label: `Cumulative Snowfall ${primaryYear}`,
            data: snowCumulative,
            borderColor: 'rgb(100, 150, 200)',
            backgroundColor: 'rgba(100, 150, 200, 0.2)',
            borderWidth: 3,
            pointRadius: 2,
            fill: 'origin'
        }
    ];

    if (comparisonData) {
        snowTotalDatasets.push({
            label: `Cumulative Snowfall ${comparisonYear}`,
            data: compSnowCumulative,
            borderColor: 'rgb(138, 43, 226)',
            backgroundColor: 'rgba(138, 43, 226, 0.2)',
            borderDash: [5, 5],
            borderWidth: 3,
            pointRadius: 2,
            fill: 'origin'
        });
    }

    const snowTotalTitle = comparisonData
        ? `Total Snowfall: ${primaryYear} = ${snowSum.toFixed(1)} cm | ${comparisonYear} = ${compSnowSum.toFixed(1)} cm`
        : `Total Snowfall: ${snowSum.toFixed(1)} cm`;

    charts.snowTotal = new Chart(document.getElementById('snow-total-chart'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: snowTotalDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { size: fontSize }
                    }
                },
                title: {
                    display: true,
                    text: snowTotalTitle,
                    font: { size: titleSize }
                }
            },
            scales: {
                x: {
                    ticks: {
                        font: { size: fontSize },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: { size: fontSize }
                    },
                    title: {
                        display: true,
                        text: 'Cumulative Snowfall (cm)',
                        font: { size: titleSize }
                    }
                }
            }
        }
    });
}
