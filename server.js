const fs = require('fs');
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Database connection pool
const pool = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    port: process.env.MYSQLPORT,
    database: process.env.MYSQLDATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true
});

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.sendStatus(401);
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Register user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, first_name, last_name, user_type } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [result] = await pool.execute(
            'INSERT INTO users (email, password_hash, first_name, last_name, user_type) VALUES (?, ?, ?, ?, ?)',
            [email, hashedPassword, first_name, last_name, user_type || 'tourist']
        );
        
        if (user_type === 'guide') {
            await pool.execute('INSERT INTO guides (user_id) VALUES (?)', [result.insertId]);
        }
        
        res.status(201).json({ message: 'User created successfully', user_id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) return res.status(401).json({ error: 'User not found' });
        
        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) return res.status(401).json({ error: 'Invalid password' });
        
        const token = jwt.sign(
            { user_id: user.user_id, email: user.email, user_type: user.user_type },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({ 
            token, 
            user: { 
                id: user.user_id, 
                email: user.email, 
                type: user.user_type, 
                name: `${user.first_name} ${user.last_name}` 
            } 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all experiences
app.get('/api/experiences', async (req, res) => {
    try {
        const [experiences] = await pool.execute(`
            SELECT e.*, u.first_name, u.last_name 
            FROM experiences e
            JOIN guides g ON e.guide_id = g.guide_id
            JOIN users u ON g.user_id = u.user_id
            WHERE e.is_active = TRUE
        `);
        res.json(experiences);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single experience
app.get('/api/experiences/:id', async (req, res) => {
    try {
        const [experiences] = await pool.execute(`
            SELECT e.*, u.first_name, u.last_name 
            FROM experiences e
            JOIN guides g ON e.guide_id = g.guide_id
            JOIN users u ON g.user_id = u.user_id
            WHERE e.experience_id = ?
        `, [req.params.id]);
        
        if (experiences.length === 0) return res.status(404).json({ error: 'Experience not found' });
        
        res.json(experiences[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create experience (guide only)
app.post('/api/experiences', authenticateToken, async (req, res) => {
    if (req.user.user_type !== 'guide') {
        return res.status(403).json({ error: 'Only guides can create experiences' });
    }
    
    try {
        const { title, description, location, duration_hours, max_participants, price_per_person, category } = req.body;
        
        const [guides] = await pool.execute('SELECT guide_id FROM guides WHERE user_id = ?', [req.user.user_id]);
        if (guides.length === 0) return res.status(404).json({ error: 'Guide profile not found' });
        
        const [result] = await pool.execute(
            'INSERT INTO experiences (guide_id, title, description, location, duration_hours, max_participants, price_per_person, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [guides[0].guide_id, title, description, location, duration_hours, max_participants, price_per_person, category]
        );
        
        res.status(201).json({ message: 'Experience created', experience_id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create booking
app.post('/api/bookings', authenticateToken, async (req, res) => {
    if (req.user.user_type !== 'tourist') {
        return res.status(403).json({ error: 'Only tourists can make bookings' });
    }
    
    try {
        const { experience_id, scheduled_date, num_participants } = req.body;
        
        const [experiences] = await pool.execute('SELECT price_per_person FROM experiences WHERE experience_id = ?', [experience_id]);
        if (experiences.length === 0) return res.status(404).json({ error: 'Experience not found' });
        
        const total_amount = experiences[0].price_per_person * num_participants;
        
        const [result] = await pool.execute(
            'INSERT INTO bookings (experience_id, tourist_id, booking_date, scheduled_date, num_participants, total_amount) VALUES (?, ?, CURDATE(), ?, ?, ?)',
            [experience_id, req.user.user_id, scheduled_date, num_participants, total_amount]
        );
        
        // Calculate revenue distribution (85% guide, 15% platform)
        const guide_amount = total_amount * 0.85;
        const platform_amount = total_amount * 0.15;
        
        await pool.execute(
            'INSERT INTO revenue_distribution (booking_id, guide_amount, platform_amount, total_amount) VALUES (?, ?, ?, ?)',
            [result.insertId, guide_amount, platform_amount, total_amount]
        );
        
        res.status(201).json({ message: 'Booking created', booking_id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get my bookings
app.get('/api/bookings', authenticateToken, async (req, res) => {
    try {
        let query;
        let params;
        
        if (req.user.user_type === 'tourist') {
            query = `
                SELECT b.*, e.title 
                FROM bookings b
                JOIN experiences e ON b.experience_id = e.experience_id
                WHERE b.tourist_id = ?
            `;
            params = [req.user.user_id];
        } else {
            query = `
                SELECT b.*, e.title, u.first_name, u.last_name 
                FROM bookings b
                JOIN experiences e ON b.experience_id = e.experience_id
                JOIN guides g ON e.guide_id = g.guide_id
                JOIN users u ON b.tourist_id = u.user_id
                WHERE g.user_id = ?
            `;
            params = [req.user.user_id];
        }
        
        query += ' ORDER BY b.created_at DESC';
        
        const [bookings] = await pool.execute(query, params);
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Submit review
app.post('/api/reviews', authenticateToken, async (req, res) => {
    try {
        const { booking_id, rating, review_text } = req.body;
        
        const [bookings] = await pool.execute(
            'SELECT b.*, e.guide_id, e.experience_id FROM bookings b JOIN experiences e ON b.experience_id = e.experience_id WHERE b.booking_id = ? AND b.tourist_id = ? AND b.status = "completed"',
            [booking_id, req.user.user_id]
        );
        
        if (bookings.length === 0) return res.status(403).json({ error: 'Invalid booking or not completed' });
        
        const booking = bookings[0];
        
        await pool.execute(
            'INSERT INTO reviews (booking_id, tourist_id, guide_id, experience_id, rating, review_text) VALUES (?, ?, ?, ?, ?, ?)',
            [booking_id, req.user.user_id, booking.guide_id, booking.experience_id, rating, review_text]
        );
        
        // Update guide rating
        await pool.execute(`
            UPDATE guides g
            SET rating = (SELECT AVG(rating) FROM reviews WHERE guide_id = g.guide_id),
                total_reviews = (SELECT COUNT(*) FROM reviews WHERE guide_id = g.guide_id)
            WHERE guide_id = ?
        `, [booking.guide_id]);
        
        res.status(201).json({ message: 'Review submitted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get revenue analytics
app.get('/api/analytics/revenue', authenticateToken, async (req, res) => {
    try {
        let query;
        let params = [];
        
        if (req.user.user_type === 'admin') {
            query = `
                SELECT DATE_FORMAT(b.scheduled_date, '%Y-%m') as month,
                       SUM(rd.guide_amount) as total_guide_revenue,
                       SUM(rd.platform_amount) as total_platform_revenue,
                       COUNT(b.booking_id) as total_bookings
                FROM bookings b
                JOIN revenue_distribution rd ON b.booking_id = rd.booking_id
                WHERE b.status = 'completed'
                GROUP BY DATE_FORMAT(b.scheduled_date, '%Y-%m')
                ORDER BY month DESC
            `;
        } else if (req.user.user_type === 'guide') {
            query = `
                SELECT DATE_FORMAT(b.scheduled_date, '%Y-%m') as month,
                       SUM(rd.guide_amount) as my_revenue,
                       COUNT(b.booking_id) as total_bookings
                FROM bookings b
                JOIN revenue_distribution rd ON b.booking_id = rd.booking_id
                JOIN experiences e ON b.experience_id = e.experience_id
                JOIN guides g ON e.guide_id = g.guide_id
                WHERE g.user_id = ? AND b.status = 'completed'
                GROUP BY DATE_FORMAT(b.scheduled_date, '%Y-%m')
            `;
            params = [req.user.user_id];
        }
        
        const [analytics] = await pool.execute(query, params);
        res.json(analytics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3001;

async function runSchema() {
    try {
        const sql = fs.readFileSync('./schema.sql', 'utf8');

        const statements = sql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length);

        for (const statement of statements) {
            await pool.query(statement);
        }

        console.log("✅ Database schema executed successfully");
    } catch (err) {
        console.error("❌ Error executing schema:", err.message);
    }
}
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    await runSchema();
});
