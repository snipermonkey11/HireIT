# Azure Deployment Checklist

## Before Deployment
- [ ] Update `Backend/.env.production` with correct frontend URL
- [ ] Update `Frontend/.env.production` with your Azure backend URL
- [ ] Commit all changes to your Git repository

## Azure Setup Steps
- [ ] Login to Azure: `az login`
- [ ] Create resource group: `az group create --name MyHireITResourceGroup --location eastus`
- [ ] Create App Service Plan: `az appservice plan create --name HireITPlan --resource-group MyHireITResourceGroup --sku B1 --is-linux`
- [ ] Create Web App: `az webapp create --resource-group MyHireITResourceGroup --plan HireITPlan --name hireit-backend --runtime "NODE|18-lts"`
- [ ] Configure environment variables: `az webapp config appsettings set --resource-group MyHireITResourceGroup --name hireit-backend --settings PORT=8080 ...`
- [ ] Configure deployment source (GitHub or Local Git)
- [ ] Deploy your code to Azure

## Post-Deployment
- [ ] Test the health endpoint: `https://your-app-name.azurewebsites.net/health`
- [ ] Deploy your frontend application
- [ ] Test user registration and email verification
- [ ] Check application logs if any issues: `az webapp log tail --name your-app-name --resource-group MyHireITResourceGroup`

## Common Issues
- Email verification not working: Check email settings, SMTP configuration, and frontend URL in environment variables
- Database connection issues: Verify the connection string and ensure the Azure SQL Server allows connections from App Service
- CORS errors: Make sure the FRONTEND_URL in Azure App Service settings exactly matches your deployed frontend URL 