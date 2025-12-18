# Weather Data Analysis Dashboard

A comprehensive weather analysis dashboard built with Leaflet maps and Chart.js visualizations. Select any location on Earth and analyze historical weather data with detailed charts for temperature, precipitation, wind, solar radiation, and more.

## Features

- **Interactive Map**: Click anywhere on the Leaflet map to select your location
- **Flexible Date Range**: Select any historical date range for analysis
- **Comprehensive Weather Charts**:
  - Temperature Analysis (Max, Mean, Min)
  - Precipitation Analysis (Total, Rain, Snowfall)
  - Wind Speed Analysis (Max Speed, Gusts)
  - Solar Radiation
  - Humidity & Pressure
  - Cloud Cover & Precipitation Hours

## Data Source

Weather data is provided by [Open-Meteo](https://open-meteo.com/), a free weather API that provides historical weather data without requiring an API key.

## Technologies Used

- **Leaflet** - Interactive maps
- **Chart.js** - Weather data visualization
- **Flatpickr** - Date range picker
- **Open-Meteo API** - Historical weather data

## Live Demo

Visit the [live demo](https://andrewnakas.github.io/Gefs_historical_data_viewer/) to try it out!

## How to Use

1. Click on any location on the map to select it
2. Choose your start and end dates
3. Click "Fetch Weather Data" to load and visualize the weather information
4. Scroll down to view all the weather analysis charts

## Local Development

Simply open `index.html` in a web browser - no build process required!

## License

MIT
