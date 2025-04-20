const paymentRoutes = require('./routes/payment');

// Mount routes
app.use('/api/users', userRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/payment', paymentRoutes); 