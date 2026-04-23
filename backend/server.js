// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'darandha_eidgah_secret_key_2024';

// Middleware
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'https://darandha-eidgah-committee.vercel.app',
        'https://darandha-eidgah-admin.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/darandha_eidgah';
mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// ========== ENHANCED SCHEMAS ==========

// Member Schema
const memberSchema = new mongoose.Schema({
    name: { type: String, required: true },
    nameAs: String,
    phone: String,
    address: String,
    role: { type: String, default: 'Member' },
    joinDate: { type: Date, default: Date.now },
    status: { type: String, default: 'active' },
});

// Enhanced Event Schema with time, location, and category
const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    titleAs: String,
    description: String,
    descriptionAs: String,
    date: { type: Date, required: true },
    time: { type: String, default: '12:00 PM' },
    endTime: String,
    location: String,
    locationAs: String,
    image: String,
    imageUrl: String,
    category: { 
        type: String, 
        enum: ['today', 'upcoming', 'past'],
        default: 'upcoming'
    },
    status: { 
        type: String, 
        enum: ['active', 'cancelled', 'completed'],
        default: 'active'
    },
    featured: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

// Auto-update category based on date
eventSchema.pre('save', function(next) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(this.date);
    eventDate.setHours(0, 0, 0, 0);
    
    if (eventDate.getTime() === today.getTime()) {
        this.category = 'today';
    } else if (eventDate > today) {
        this.category = 'upcoming';
    } else {
        this.category = 'past';
    }
    next();
});

// Setting Schema
const settingSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: String,
    valueAs: String,
});

// Donation Schema
const donationSchema = new mongoose.Schema({
    name: String,
    amount: Number,
    date: { type: Date, default: Date.now },
    transactionId: String,
    status: { type: String, default: 'pending' },
});

// Admin Schema
const adminSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    email: String,
    role: { type: String, default: 'admin' },
    refreshToken: String,
    lastLogin: Date,
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

// ========== MODELS ==========
const Member = mongoose.model('Member', memberSchema);
const Event = mongoose.model('Event', eventSchema);
const Setting = mongoose.model('Setting', settingSchema);
const Donation = mongoose.model('Donation', donationSchema);
const Admin = mongoose.model('Admin', adminSchema);

// ========== MULTER SETUP FOR IMAGE UPLOADS ==========
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'event-' + uniqueSuffix + path.extname(file.originalname));
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only images are allowed (jpeg, jpg, png, gif, webp)'));
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// ========== AUTH MIDDLEWARE ==========
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired. Please login again.' });
        }
        return res.status(403).json({ error: 'Invalid token.' });
    }
};

// ========== DATABASE INITIALIZATION ==========
async function initDatabase() {
    try {
        // Create default admin
        const adminExists = await Admin.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await Admin.create({ 
                username: 'admin', 
                password: hashedPassword,
                role: 'super_admin',
                email: 'admin@darandhaeidgah.org'
            });
            console.log('✅ Default admin created (username: admin, password: admin123)');
        }

        // Create default settings
        const defaultSettings = [
            { key: 'whatsapp_number', value: '+919876543210' },
            { key: 'contact_email', value: 'info@darandhaeidgah.org' },
            { key: 'contact_phone', value: '+91 98765 43210' },
            { key: 'about_content', value: 'Darandha Eidgah Committee is dedicated to serving the Muslim community by maintaining the graveyard with dignity and respect. We provide funeral services, maintain records, and support bereaved families.' },
            { key: 'about_content_as', value: 'দৰংদহ ঈদগাহ কমিটিয়ে মুছলমান সমাজক মৰ্যাদা আৰু সন্মানেৰে কবৰস্থান পৰিচালনা কৰি সেৱা আগবঢ়োৱাত নিয়োজিত। আমি জানাজা সেৱা প্ৰদান কৰো, অভিলেখ ৰাখো, আৰু শোকাহত পৰিয়ালবোৰক সহায় কৰো।' },
        ];

        for (const setting of defaultSettings) {
            const exists = await Setting.findOne({ key: setting.key });
            if (!exists) {
                await Setting.create(setting);
            }
        }
        
        console.log('✅ Database initialization complete');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

initDatabase();

// ========== API ROUTES ==========

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Darandha Eidgah API is running',
        timestamp: new Date().toISOString(),
        endpoints: {
            members: '/api/members',
            events: '/api/events',
            settings: '/api/settings',
            donations: '/api/donations',
            stats: '/api/stats'
        }
    });
});

// ========== AUTHENTICATION ROUTES ==========

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        if (!admin.isActive) {
            return res.status(401).json({ error: 'Account is deactivated. Contact super admin.' });
        }
        
        const valid = await bcrypt.compare(password, admin.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Update last login
        admin.lastLogin = new Date();
        await admin.save();
        
        const token = jwt.sign(
            { id: admin._id, username: admin.username, role: admin.role }, 
            JWT_SECRET, 
            { expiresIn: '7d' }
        );
        
        res.json({ 
            success: true,
            token, 
            username: admin.username, 
            role: admin.role,
            message: 'Login successful'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Verify token
app.get('/api/auth/verify', authMiddleware, async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin.id).select('-password');
        res.json({ valid: true, user: admin });
    } catch (error) {
        res.json({ valid: false });
    }
});

// ========== MEMBERS CRUD ==========

// Get all members (public)
app.get('/api/members', async (req, res) => {
    try {
        const members = await Member.find().sort({ name: 1 });
        res.json(members);
    } catch (error) {
        console.error('Error fetching members:', error);
        res.status(500).json({ error: 'Failed to fetch members' });
    }
});

// Get single member
app.get('/api/members/:id', async (req, res) => {
    try {
        const member = await Member.findById(req.params.id);
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        res.json(member);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch member' });
    }
});

// Create member (protected)
app.post('/api/members', authMiddleware, async (req, res) => {
    try {
        console.log('Received member data:', req.body);
        
        const { name, nameAs, phone, address, role } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        const member = new Member({
            name,
            nameAs: nameAs || '',
            phone: phone || '',
            address: address || '',
            role: role || 'Member',
            joinDate: new Date(),
            status: 'active'
        });
        
        await member.save();
        console.log('Member saved:', member);
        res.status(201).json(member);
    } catch (error) {
        console.error('Error creating member:', error);
        res.status(500).json({ error: 'Failed to create member: ' + error.message });
    }
});

// Update member (protected)
app.put('/api/members/:id', authMiddleware, async (req, res) => {
    try {
        const member = await Member.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true, runValidators: true }
        );
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        res.json(member);
    } catch (error) {
        console.error('Error updating member:', error);
        res.status(500).json({ error: 'Failed to update member' });
    }
});

// Delete member (protected)
app.delete('/api/members/:id', authMiddleware, async (req, res) => {
    try {
        const member = await Member.findByIdAndDelete(req.params.id);
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        res.json({ success: true, message: 'Member deleted successfully' });
    } catch (error) {
        console.error('Error deleting member:', error);
        res.status(500).json({ error: 'Failed to delete member' });
    }
});

// ========== ENHANCED EVENTS CRUD ==========

// Get all events with filters
app.get('/api/events', async (req, res) => {
    try {
        const { category, featured, limit, status } = req.query;
        let query = {};
        
        if (category) query.category = category;
        if (featured) query.featured = featured === 'true';
        if (status) query.status = status;
        
        let eventsQuery = Event.find(query).sort({ date: category === 'past' ? -1 : 1 });
        
        if (limit) eventsQuery = eventsQuery.limit(parseInt(limit));
        
        const events = await eventsQuery;
        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Get events by category
app.get('/api/events/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const events = await Event.find({ category }).sort({ date: category === 'past' ? -1 : 1 });
        res.json(events);
    } catch (error) {
        console.error('Error fetching events by category:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Get upcoming events
app.get('/api/events/upcoming', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const events = await Event.find({ 
            date: { $gte: today },
            category: { $ne: 'past' },
            status: 'active'
        }).sort({ date: 1 });
        res.json(events);
    } catch (error) {
        console.error('Error fetching upcoming events:', error);
        res.status(500).json({ error: 'Failed to fetch upcoming events' });
    }
});

// Get today's events
app.get('/api/events/today', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const events = await Event.find({
            date: { $gte: today, $lt: tomorrow },
            status: 'active'
        }).sort({ time: 1 });
        res.json(events);
    } catch (error) {
        console.error('Error fetching today\'s events:', error);
        res.status(500).json({ error: 'Failed to fetch today\'s events' });
    }
});

// Get single event
app.get('/api/events/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json(event);
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ error: 'Failed to fetch event' });
    }
});

// Create event with image upload (protected)
app.post('/api/events', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        let eventData;
        
        // Handle form-data or JSON
        if (req.body.data) {
            eventData = JSON.parse(req.body.data);
        } else {
            eventData = req.body;
        }
        
        // Validate required fields
        if (!eventData.title) {
            return res.status(400).json({ error: 'Title is required' });
        }
        
        if (!eventData.date) {
            return res.status(400).json({ error: 'Date is required' });
        }
        
        // Handle image upload
        if (req.file) {
            eventData.image = `/uploads/${req.file.filename}`;
            eventData.imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }
        
        const event = new Event(eventData);
        await event.save();
        
        console.log('Event saved:', event);
        res.status(201).json(event);
    } catch (error) {
        console.error('Event creation error:', error);
        res.status(500).json({ error: 'Failed to create event: ' + error.message });
    }
});

// Update event with image (protected)
app.put('/api/events/:id', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        let eventData;
        
        // Handle form-data or JSON
        if (req.body.data) {
            eventData = JSON.parse(req.body.data);
        } else {
            eventData = req.body;
        }
        
        // Handle new image upload
        if (req.file) {
            // Delete old image if exists
            const oldEvent = await Event.findById(req.params.id);
            if (oldEvent && oldEvent.image) {
                const oldImagePath = path.join(__dirname, oldEvent.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            
            eventData.image = `/uploads/${req.file.filename}`;
            eventData.imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }
        
        const event = await Event.findByIdAndUpdate(
            req.params.id,
            eventData,
            { new: true, runValidators: true }
        );
        
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        console.log('Event updated:', event);
        res.json(event);
    } catch (error) {
        console.error('Event update error:', error);
        res.status(500).json({ error: 'Failed to update event: ' + error.message });
    }
});

// Delete event (protected)
app.delete('/api/events/:id', authMiddleware, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        // Delete associated image
        if (event.image) {
            const imagePath = path.join(__dirname, event.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        await Event.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

// Get event statistics
app.get('/api/events/stats/summary', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const upcoming = await Event.countDocuments({ 
            date: { $gt: today },
            status: 'active'
        });
        
        const todayCount = await Event.countDocuments({ 
            date: { $gte: today, $lt: tomorrow },
            status: 'active'
        });
        
        const past = await Event.countDocuments({ 
            date: { $lt: today },
            status: 'active'
        });
        
        const total = await Event.countDocuments();
        const featured = await Event.countDocuments({ featured: true });
        
        res.json({ 
            upcoming, 
            today: todayCount, 
            past,
            total,
            featured
        });
    } catch (error) {
        console.error('Error fetching event stats:', error);
        res.status(500).json({ error: 'Failed to fetch event stats' });
    }
});

// ========== SETTINGS CRUD ==========

// Get all settings (public)
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await Setting.find();
        const settingsObj = {};
        settings.forEach(s => { 
            settingsObj[s.key] = { value: s.value, valueAs: s.valueAs }; 
        });
        res.json(settingsObj);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update setting (protected)
app.put('/api/settings/:key', authMiddleware, async (req, res) => {
    try {
        const setting = await Setting.findOneAndUpdate(
            { key: req.params.key },
            { value: req.body.value, valueAs: req.body.valueAs },
            { upsert: true, new: true }
        );
        res.json(setting);
    } catch (error) {
        console.error('Error updating setting:', error);
        res.status(500).json({ error: 'Failed to update setting' });
    }
});

// ========== DONATIONS CRUD ==========

// Get all donations (protected)
app.get('/api/donations', authMiddleware, async (req, res) => {
    try {
        const donations = await Donation.find().sort({ date: -1 });
        res.json(donations);
    } catch (error) {
        console.error('Error fetching donations:', error);
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

// Create donation (public)
app.post('/api/donations', async (req, res) => {
    try {
        const donation = new Donation({
            ...req.body,
            status: 'completed',
            date: new Date()
        });
        await donation.save();
        console.log('Donation recorded:', donation);
        res.status(201).json(donation);
    } catch (error) {
        console.error('Error recording donation:', error);
        res.status(500).json({ error: 'Failed to record donation' });
    }
});

// ========== STATISTICS ==========

// Get dashboard stats (protected)
app.get('/api/stats', authMiddleware, async (req, res) => {
    try {
        const memberCount = await Member.countDocuments();
        const eventCount = await Event.countDocuments();
        const donationResult = await Donation.aggregate([
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalDonations = donationResult[0]?.total || 0;
        
        // Get recent donations
        const recentDonations = await Donation.find()
            .sort({ date: -1 })
            .limit(5);
        
        // Get event stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcomingEvents = await Event.countDocuments({ 
            date: { $gt: today },
            status: 'active'
        });
        
        res.json({ 
            memberCount, 
            eventCount, 
            totalDonations,
            upcomingEvents,
            recentDonations
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ========== ERROR HANDLING MIDDLEWARE ==========

// 404 handler for undefined routes
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.url}`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    
    if (err instanceof multer.MulterError) {
        if (err.code === 'FILE_TOO_LARGE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 API URL: http://localhost:${PORT}/api`);
    console.log(`🔐 JWT Secret: ${JWT_SECRET ? 'Configured ✅' : 'Missing ❌'}`);
    console.log(`💾 MongoDB: ${MONGODB_URI.includes('localhost') ? 'Local ✅' : 'Atlas ✅'}`);
    console.log(`\n📋 Available Endpoints:`);
    console.log(`   GET    /api/health`);
    console.log(`   POST   /api/auth/login`);
    console.log(`   GET    /api/members`);
    console.log(`   POST   /api/members (protected)`);
    console.log(`   GET    /api/events`);
    console.log(`   GET    /api/events/category/:category`);
    console.log(`   GET    /api/events/upcoming`);
    console.log(`   GET    /api/events/today`);
    console.log(`   POST   /api/events (protected)`);
    console.log(`   GET    /api/settings`);
    console.log(`   GET    /api/donations (protected)`);
    console.log(`   POST   /api/donations`);
    console.log(`   GET    /api/stats (protected)`);
    console.log(`   GET    /api/events/stats/summary`);
});
