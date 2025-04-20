# Azure App Service Deployment Guide

This guide provides step-by-step instructions for deploying the HireIT backend with email verification to Azure App Service.

## Prerequisites

1. **Azure Account**: You need an active Azure account. If you don't have one, create a free account at [https://azure.microsoft.com/free/](https://azure.microsoft.com/free/).
2. **Azure CLI**: The Azure Command Line Interface should be installed on your machine.
3. **Node.js and npm**: Ensure you have Node.js and npm installed locally.
4. **Git**: Ensure Git is installed on your local machine.

## Step 1: Prepare Your Application

1. Ensure all your changes are committed to your Git repository.
2. Update the `.env.production` file with your production environment variables.
3. Make sure to update the `FRONTEND_URL` to point to your deployed frontend application URL.

## Step 2: Log into Azure

Open a terminal or command prompt and log into Azure:

```bash
az login
```

This will open a browser window for you to log in with your Azure credentials.

## Step 3: Create a Resource Group (if you don't have one already)

```bash
az group create --name MyHireITResourceGroup --location eastus
```

Replace `MyHireITResourceGroup` with your preferred name and `eastus` with your preferred region.

## Step 4: Create an App Service Plan

```bash
az appservice plan create --name HireITPlan --resource-group MyHireITResourceGroup --sku B1 --is-linux
```

This creates a Basic (B1) tier Linux App Service Plan. You can choose different pricing tiers based on your needs.

## Step 5: Create a Web App

```bash
az webapp create --resource-group MyHireITResourceGroup --plan HireITPlan --name hireit-backend --runtime "NODE|18-lts"
```

Replace `hireit-backend` with your preferred unique web app name. This name will be part of your app's URL: `https://hireit-backend.azurewebsites.net`.

## Step 6: Configure Application Settings

Set your environment variables in the Azure App Service:

```bash
az webapp config appsettings set --resource-group MyHireITResourceGroup --name hireit-backend --settings \
  PORT=8080 \
  DB_CONNECTION_STRING="Server=tcp:hireitserver.database.windows.net,1433;Initial Catalog=capstone;Persist Security Info=False;User ID=hireit;Password=Mendoza123;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;" \
  JWT_SECRET="your_jwt_secret_here" \
  EMAIL_USER="hireit2025@gmail.com" \
  EMAIL_APP_PASSWORD="idzshelylfqdeuhu" \
  EMAIL_FROM_NAME="HireIT Support" \
  FRONTEND_URL="https://your-frontend-deployment-url.com" \
  NODE_ENV="production" \
  WEBSITE_NODE_DEFAULT_VERSION="~18" \
  SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

Make sure to replace the values with your actual configuration. Especially update the `FRONTEND_URL` to point to your deployed frontend.

## Step 7: Configure Deployment Source

You can deploy directly from GitHub or use Local Git deployment.

### Option 1: Deploy from GitHub

1. Go to the [Azure Portal](https://portal.azure.com/)
2. Navigate to your App Service
3. Go to Deployment Center
4. Select GitHub as the source
5. Follow the prompts to authenticate and select your repository and branch

### Option 2: Deploy from Local Git

Configure local Git deployment:

```bash
az webapp deployment source config-local-git --name hireit-backend --resource-group MyHireITResourceGroup
```

This will output a Git URL. Add it as a remote to your local repository:

```bash
git remote add azure <git-url-from-previous-command>
```

Then push to the Azure remote:

```bash
git push azure main
```

## Step 8: Verify Deployment

1. Open a browser and go to `https://hireit-backend.azurewebsites.net/health`
2. You should see a JSON response indicating that your server is up and running.

## Step 9: Configure Frontend

1. Update your frontend's API URL to point to your Azure backend:
   - In your frontend project, update the `.env.production` file:
   ```
   VITE_API_URL=https://hireit-backend.azurewebsites.net/api
   ```

2. Deploy your frontend application to your preferred hosting service.

## Step 10: Test Email Verification

1. Register a new user on your deployed application
2. Check if the verification email is sent correctly
3. Click the verification link and ensure it redirects to your frontend application
4. Confirm that the email verification process completes successfully

## Troubleshooting

### View Logs

To view application logs:

```bash
az webapp log tail --name hireit-backend --resource-group MyHireITResourceGroup
```

### Restart the App Service

If you encounter issues, you can restart the App Service:

```bash
az webapp restart --name hireit-backend --resource-group MyHireITResourceGroup
```

### Check Email Configuration

If email verification is not working:

1. Check the application logs for any errors related to email sending
2. Verify that your Gmail account allows less secure apps or is correctly configured for app passwords
3. Ensure your App Service settings include the correct email credentials

## Additional Resources

- [Azure App Service Documentation](https://docs.microsoft.com/en-us/azure/app-service/)
- [Node.js on Azure App Service](https://docs.microsoft.com/en-us/azure/app-service/quickstart-nodejs)
- [Continuous Deployment to Azure App Service](https://docs.microsoft.com/en-us/azure/app-service/deploy-continuous-deployment) 