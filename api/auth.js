import crypto from 'crypto';
import pkg from 'pg';
const { Pool } = pkg;
import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';

const app = express();

// Enable CORS for all routes
app.use(cors());
app.use(bodyParser.json());

// Connection config
const pool = new Pool({
  connectionString: 'postgresql://podcast_owner:npg_4AqXVbtgrGz3@ep-noisy-resonance-a5j31fh8-pooler.us-east-2.aws.neon.tech/podcast?sslmode=require',
  ssl: {
    rejectUnauthorized: true
  }
});

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

// Helper functions
const generateSalt = () => Math.random().toString(36).substring(2, 15);
const hashPassword = (password, salt) => crypto.createHash('sha256').update(password + salt).digest('hex');

// Initialize database tables
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('Initializing database...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        salt TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  } finally {
    client.release();
  }
}

// Initialize database on startup
initializeDatabase().catch(err => {
  console.error('Database initialization failed:', err);
});

// Database connection test endpoint
app.get('/db-test', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT NOW()');
      res.status(200).json({ 
        success: true, 
        message: 'Database connection successful',
        timestamp: result.rows[0].now
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database Connection Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Database connection failed',
      details: error.message
    });
  }
});

// Database schema check endpoint
app.get('/db-schema', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
      `);
      res.status(200).json({ 
        success: true, 
        columns: result.rows
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Schema Check Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check schema',
      details: error.message
    });
  }
});

// RESET ENDPOINT - Drops and recreates the users table
app.post('/reset', async (req, res) => {
  try {
    console.log('Reset request received - recreating database schema');
    
    const client = await pool.connect();
    try {
      // Drop and recreate the users table
      await client.query('DROP TABLE IF EXISTS users');
      await client.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          salt TEXT NOT NULL,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('Database reset successfully');
      return res.status(200).json({
        success: true,
        message: 'Database has been reset and recreated successfully.'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Reset Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to reset database', 
      details: error.message 
    });
  }
});

// SIGNUP ENDPOINT
app.post('/signup', async (req, res) => {
  try {
    console.log('Signup request received:', req.body);
    const { email, password, name, phone } = req.body;
    
    if (!email || !password || !name || !phone) {
      return res.status(400).json({ success: false, message: 'Email, password, name, and phone number are required' });
    }
    
    // Check if user already exists
    const checkResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (checkResult.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'User already exists' });
    }
    
    // Create new user
    const salt = generateSalt();
    const hashedPassword = hashPassword(password, salt);
    
    // Store user with new fields
    await pool.query(
      'INSERT INTO users (email, password, salt, name, phone) VALUES ($1, $2, $3, $4, $5)',
      [email, hashedPassword, salt, name, phone]
    );
    
    console.log('User created successfully:', email);
    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      email,
      name,
      phone
    });
  } catch (error) {
    console.error('Signup Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      details: error.message 
    });
  }
});

// SIGNIN ENDPOINT
app.post('/signin', async (req, res) => {
  try {
    console.log('Signin request received:', req.body);
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    
    // Check if user exists
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const hashedPassword = hashPassword(password, user.salt);
    
    if (hashedPassword !== user.password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    console.log('User logged in successfully:', email);
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      email: user.email,
      name: user.name,
      phone: user.phone
    });
  } catch (error) {
    console.error('Signin Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      details: error.message 
    });
  }
});

// LIST ALL USERS ENDPOINT - Now including all user data for internal use
app.get('/users', async (req, res) => {
  try {
    // Updated to include name, phone, and password (since this is for internal use only)
    const result = await pool.query('SELECT id, email, name, phone, password, salt, created_at FROM users');
    
    return res.status(200).json({
      success: true,
      userCount: result.rows.length,
      users: result.rows
    });
  } catch (error) {
    console.error('List Users Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Export for serverless environments if needed
export default app;