const express = require('express');
require('dotenv').config();

// Initialize the Express app
const app = express();

// Middleware to parse incoming JSON data (Crucial for req.body)
app.use(express.json());

// Import your routes
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes'); // <-- 1. Import post routes

// Mount the routes to a specific URL path
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes); // <-- 2. Mount post routes

// A simple test route just to see if the server is alive
app.get('/', (req, res) => {
  res.send('Blog API is running!');
});

// Start the server only if this file is run directly
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
}

// Export the app for testing (Supertest)
module.exports = app;