#!/bin/bash

# ----------------------
# Deployment Script
# ----------------------

# 1. Install npm packages
echo "Installing npm packages..."
npm install --production

# 2. Copy .env.production to .env for Azure
echo "Setting up environment variables..."
cp .env.production .env

# 3. Make sure upload directories exist
echo "Setting up upload directories..."
mkdir -p uploads/photos
mkdir -p uploads/gcash

# 4. Give permissions to the app directories
echo "Setting directory permissions..."
chmod -R 755 .

# 5. Print completion message
echo "Deployment script completed" 