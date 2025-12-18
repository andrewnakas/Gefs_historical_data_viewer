// Global variables
let map;
let marker;
let selectedLat = null;
let selectedLon = null;
let charts = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeDatePickers();
    setupEventListeners();
});

// Initialize Leaflet map
function initializeMap() {
    // Create map centered on US
    map = L.map('map').setView([39.8283, -98.5795], 4);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    // Add click event to map
    map.on('click', function(e) {
        const { lat, lng } = e.latlng;
        selectLocation(lat, lng);
    });
}

// Select location on map
function selectLocation(lat, lon) {
    selectedLat = lat;
    selectedLon = lon;

    // Remove existing marker if any
    if (marker) {
        map.removeLayer(marker);
    }

    // Add new marker
    marker = L.marker([lat, lon]).addTo(map);
    marker.bindPopup(`<b>Selected Location</b><br>Lat: ${lat.toFixed(4)}<br>Lon: ${lon.toFixed(4)}`).openPopup();

    // Update info display
    document.getElementById('location-info').textContent = `Latitude: ${lat.toFixed(4)}, Longitude: ${lon.toFixed(4)}`;
    document.getElementById('coords-info').textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

    // Reverse geocoding to get location name
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
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
        dateFormat: "Y-m-d"
    });

    flatpickr("#end-date", {
        defaultDate: today,
        maxDate: today,
        dateFormat: "Y-m-d"
    });
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('fetch-data').addEventListener('click', fetchWeatherData);
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

    showLoading(true);
    hideError();

    try {
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

        renderCharts(data);
        document.getElementById('charts').style.display = 'block';

    } catch (error) {
        console.error('Error fetching weather data:', error);
        showError(`Failed to fetch weather data: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Render all charts
function renderCharts(data) {
    // Destroy existing charts
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });

    const dates = data.daily.time;

    // Temperature Chart
    charts.temperature = new Chart(document.getElementById('temp-chart'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Max Temperature (°C)',
                    data: data.daily.temperature_2m_max,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Mean Temperature (°C)',
                    data: data.daily.temperature_2m_mean,
                    borderColor: 'rgb(255, 159, 64)',
                    backgroundColor: 'rgba(255, 159, 64, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Min Temperature (°C)',
                    data: data.daily.temperature_2m_min,
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                }
            }
        }
    });

    // Precipitation Chart
    charts.precipitation = new Chart(document.getElementById('precip-chart'), {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Total Precipitation (mm)',
                    data: data.daily.precipitation_sum,
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: 'rgb(54, 162, 235)',
                    borderWidth: 1
                },
                {
                    label: 'Rain (mm)',
                    data: data.daily.rain_sum,
                    backgroundColor: 'rgba(75, 192, 192, 0.7)',
                    borderColor: 'rgb(75, 192, 192)',
                    borderWidth: 1
                },
                {
                    label: 'Snowfall (cm)',
                    data: data.daily.snowfall_sum,
                    backgroundColor: 'rgba(201, 203, 207, 0.7)',
                    borderColor: 'rgb(201, 203, 207)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Precipitation (mm/cm)'
                    }
                }
            }
        }
    });

    // Wind Chart
    charts.wind = new Chart(document.getElementById('wind-chart'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Max Wind Speed (km/h)',
                    data: data.daily.windspeed_10m_max,
                    borderColor: 'rgb(153, 102, 255)',
                    backgroundColor: 'rgba(153, 102, 255, 0.1)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'Wind Gusts (km/h)',
                    data: data.daily.windgusts_10m_max,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Wind Speed (km/h)'
                    }
                }
            }
        }
    });

    // Solar Radiation Chart
    charts.solar = new Chart(document.getElementById('solar-chart'), {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Shortwave Radiation (MJ/m²)',
                    data: data.daily.shortwave_radiation_sum,
                    backgroundColor: 'rgba(255, 206, 86, 0.7)',
                    borderColor: 'rgb(255, 206, 86)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Solar Radiation (MJ/m²)'
                    }
                }
            }
        }
    });

    // Humidity & Pressure Chart
    charts.humidity = new Chart(document.getElementById('humidity-chart'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Relative Humidity (%)',
                    data: data.daily.relative_humidity_2m_mean,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'Surface Pressure (hPa)',
                    data: data.daily.surface_pressure_mean,
                    borderColor: 'rgb(153, 102, 255)',
                    backgroundColor: 'rgba(153, 102, 255, 0.1)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Humidity (%)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false
                    },
                    title: {
                        display: true,
                        text: 'Pressure (hPa)'
                    }
                }
            }
        }
    });

    // Cloud Cover Chart
    charts.cloud = new Chart(document.getElementById('cloud-chart'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Cloud Cover (%)',
                    data: data.daily.cloudcover_mean,
                    borderColor: 'rgb(201, 203, 207)',
                    backgroundColor: 'rgba(201, 203, 207, 0.3)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'Precipitation Hours',
                    data: data.daily.precipitation_hours,
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.3)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Cloud Cover (%)'
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
                    title: {
                        display: true,
                        text: 'Precipitation Hours'
                    }
                }
            }
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
