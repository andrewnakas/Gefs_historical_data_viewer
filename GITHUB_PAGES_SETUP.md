# GitHub Pages Setup for Claude Branches

## Quick Fix for Environment Protection Rules

The error "Branch 'claude/weather-dashboard-leaflet-9dXeD' is not allowed to deploy to github-pages" happens because of environment protection rules. Here's how to fix it:

### Option 1: Allow All Branches (Easiest)

1. Go to your repository settings: https://github.com/andrewnakas/Gefs_historical_data_viewer/settings/environments
2. Click on **"github-pages"** environment
3. Under **"Deployment branches"**, click the dropdown
4. Select **"All branches"** instead of "Protected branches only"
5. Click **"Save protection rules"**

### Option 2: Add Branch Pattern (More Secure)

1. Go to your repository settings: https://github.com/andrewnakas/Gefs_historical_data_viewer/settings/environments
2. Click on **"github-pages"** environment
3. Under **"Deployment branches"**, click the dropdown
4. Select **"Selected branches"**
5. Click **"Add deployment branch rule"**
6. Add pattern: `claude/*` (this allows all Claude branches)
7. Click **"Save protection rules"**

### Option 3: Remove Environment Protection (Simplest)

If you don't need environment protection, I can update the workflow to remove it entirely.

## After Configuration

Once you've updated the settings:

1. The workflow will automatically trigger on the next push
2. OR you can manually trigger it from: https://github.com/andrewnakas/Gefs_historical_data_viewer/actions/workflows/deploy.yml
3. Click "Run workflow" → Select branch `claude/weather-dashboard-leaflet-9dXeD` → Click "Run workflow"

## Your GitHub Pages URL

After successful deployment:
**https://andrewnakas.github.io/Gefs_historical_data_viewer/**

## Verify GitHub Pages is Enabled

Make sure GitHub Pages is configured:

1. Go to: https://github.com/andrewnakas/Gefs_historical_data_viewer/settings/pages
2. Under **"Build and deployment"**:
   - **Source**: Should be set to **"GitHub Actions"**
3. Save if needed

That's it! The site should deploy automatically after you configure the environment settings.
