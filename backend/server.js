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

// ========== ENHANCED EVENT SCHEMA ==========
const memberSchema = new mongoose.Schema({
    name: { type: String, required: true },
    nameAs: String,
    phone: String,
    address: String,
    role: { type: String, default: 'Member' },
    joinDate: { type: Date, default: Date.now },
    status: { type: String, default: 'active' },
});

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

// Pre-save middleware to auto-set category
eventSchema.pre('save', function(next) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(this.date);
    eventDate.setHours(0, 0, 0, 0);
    
    if (this.status === 'cancelled' || this.status === 'completed') {
        this.category = 'past';
    } else if (eventDate.getTime() === today.getTime()) {
        this.category = 'today';
    } else if (eventDate > today) {
        this.category = 'upcoming';
    } else {
        this.category = 'past';
    }
    next();
});

const settingSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: String,
    valueAs: String,
});

const donationSchema = new mongoose.Schema({
    name: String,
    amount: Number,
    date: { type: Date, default: Date.now },
    transactionId: String,
    status: { type: String, default: 'pending' },
});

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

// ========== MULTER SETUP ==========
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
        cb(new Error('Only images are allowed'));
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
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

// ========== AUTO-UPDATE EVENT CATEGORIES FUNCTION ==========
async function autoUpdateEventCategories() {
    try {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        const todayStart = new Date(now);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        
        // Update events that should be "today"
        await Event.updateMany(
            { 
                date: { $gte: todayStart, $lte: todayEnd },
                status: 'active'
            },
            { category: 'today' }
        );
        
        // Update events that should be "upcoming" (future dates)
        await Event.updateMany(
            { 
                date: { $gt: todayEnd },
                status: 'active'
            },
            { category: 'upcoming' }
        );
        
        // Update events that should be "past" (past dates)
        await Event.updateMany(
            { 
                date: { $lt: todayStart },
                status: 'active'
            },
            { category: 'past' }
        );
        
        // Update cancelled/completed events to past
        await Event.updateMany(
            { status: { $in: ['cancelled', 'completed'] } },
            { category: 'past' }
        );
        
        console.log('✅ Event categories auto-updated at:', new Date().toLocaleString());
    } catch (error) {
        console.error('❌ Auto-update error:', error);
    }
}

// Run auto-update every hour
setInterval(autoUpdateEventCategories, 60 * 60 * 1000);

// Run on server startup
autoUpdateEventCategories();

// ========== DATABASE INITIALIZATION ==========
async function initDatabase() {
    try {
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

// ========== HEALTH CHECK ==========
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

// ========== AUTHENTICATION ==========
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
            return res.status(401).json({ error: 'Account is deactivated' });
        }
        
        const valid = await bcrypt.compare(password, admin.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
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

app.get('/api/auth/verify', authMiddleware, async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin.id).select('-password');
        res.json({ valid: true, user: admin });
    } catch (error) {
        res.json({ valid: false });
    }
});

// ========== MEMBERS CRUD ==========
app.get('/api/members', async (req, res) => {
    try {
        const members = await Member.find().sort({ name: 1 });
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch members' });
    }
});

app.get('/api/members/:id', async (req, res) => {
    try {
        const member = await Member.findById(req.params.id);
        if (!member) return res.status(404).json({ error: 'Member not found' });
        res.json(member);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch member' });
    }
});

app.post('/api/members', authMiddleware, async (req, res) => {
    try {
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
        res.status(201).json(member);
    } catch (error) {
        console.error('Error creating member:', error);
        res.status(500).json({ error: 'Failed to create member: ' + error.message });
    }
});

app.put('/api/members/:id', authMiddleware, async (req, res) => {
    try {
        const member = await Member.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true, runValidators: true }
        );
        if (!member) return res.status(404).json({ error: 'Member not found' });
        res.json(member);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update member' });
    }
});

app.delete('/api/members/:id', authMiddleware, async (req, res) => {
    try {
        const member = await Member.findByIdAndDelete(req.params.id);
        if (!member) return res.status(404).json({ error: 'Member not found' });
        res.json({ success: true, message: 'Member deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete member' });
    }
});

// ========== ENHANCED EVENTS CRUD WITH AUTO-UPDATE ==========

// Get all events (auto-updated categories)
app.get('/api/events', async (req, res) => {
    try {
        await autoUpdateEventCategories();
        
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

// Get upcoming events
app.get('/api/events/upcoming', async (req, res) => {
    try {
        await autoUpdateEventCategories();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const events = await Event.find({ 
            date: { $gte: today },
            status: 'active',
            category: { $in: ['today', 'upcoming'] }
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
        await autoUpdateEventCategories();
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

// Get events by category
app.get('/api/events/category/:category', async (req, res) => {
    try {
        await autoUpdateEventCategories();
        const { category } = req.params;
        
        let query = { category };
        
        if (category === 'upcoming') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            query.date = { $gte: today };
            query.status = 'active';
        } else if (category === 'past') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            query.date = { $lt: today };
        }
        
        const events = await Event.find(query).sort({ date: category === 'past' ? -1 : 1 });
        res.json(events);
    } catch (error) {
        console.error('Error fetching events by category:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Get single event
app.get('/api/events/:id', async (req, res) => {
    try {
        await autoUpdateEventCategories();
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch event' });
    }
});

// Create event
app.post('/api/events', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        let eventData;
        if (req.body.data) {
            eventData = JSON.parse(req.body.data);
        } else {
            eventData = req.body;
        }
        
        if (!eventData.title) {
            return res.status(400).json({ error: 'Title is required' });
        }
        
        if (!eventData.date) {
            return res.status(400).json({ error: 'Date is required' });
        }
        
        if (req.file) {
            eventData.image = `/uploads/${req.file.filename}`;
            eventData.imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }
        
        // Auto-set category based on date
        const eventDate = new Date(eventData.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (eventDate.toDateString() === today.toDateString()) {
            eventData.category = 'today';
        } else if (eventDate > today) {
            eventData.category = 'upcoming';
        } else {
            eventData.category = 'past';
        }
        
        const event = new Event(eventData);
        await event.save();
        
        // Run auto-update after creation
        await autoUpdateEventCategories();
        
        res.status(201).json(event);
    } catch (error) {
        console.error('Event creation error:', error);
        res.status(500).json({ error: 'Failed to create event: ' + error.message });
    }
});

// Update event
app.put('/api/events/:id', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        let eventData;
        if (req.body.data) {
            eventData = JSON.parse(req.body.data);
        } else {
            eventData = req.body;
        }
        
        if (req.file) {
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
        
        // Auto-set category based on date and status
        const eventDate = new Date(eventData.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (eventData.status === 'cancelled' || eventData.status === 'completed') {
            eventData.category = 'past';
        } else if (eventDate.toDateString() === today.toDateString()) {
            eventData.category = 'today';
        } else if (eventDate > today) {
            eventData.category = 'upcoming';
        } else {
            eventData.category = 'past';
        }
        
        const event = await Event.findByIdAndUpdate(
            req.params.id,
            eventData,
            { new: true, runValidators: true }
        );
        
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        // Run auto-update after update
        await autoUpdateEventCategories();
        
        res.json(event);
    } catch (error) {
        console.error('Event update error:', error);
        res.status(500).json({ error: 'Failed to update event: ' + error.message });
    }
});

// Delete event
app.delete('/api/events/:id', authMiddleware, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        if (event.image) {
            const imagePath = path.join(__dirname, event.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        await Event.findByIdAndDelete(req.params.id);
        await autoUpdateEventCategories();
        
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

// Manual sync endpoint (for admin to force update)
app.post('/api/events/sync', authMiddleware, async (req, res) => {
    try {
        await autoUpdateEventCategories();
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayCount = await Event.countDocuments({ 
            date: { $gte: today, $lt: tomorrow },
            status: 'active'
        });
        const upcomingCount = await Event.countDocuments({ 
            date: { $gt: tomorrow },
            status: 'active'
        });
        const pastCount = await Event.countDocuments({ 
            date: { $lt: today }
        });
        
        res.json({ 
            success: true, 
            message: 'Events synchronized successfully',
            stats: { today: todayCount, upcoming: upcomingCount, past: pastCount }
        });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: 'Failed to sync events' });
    }
});

// Get event statistics
app.get('/api/events/stats/summary', async (req, res) => {
    try {
        await autoUpdateEventCategories();
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayCount = await Event.countDocuments({ 
            date: { $gte: today, $lt: tomorrow },
            status: 'active'
        });
        const upcomingCount = await Event.countDocuments({ 
            date: { $gt: tomorrow },
            status: 'active'
        });
        const pastCount = await Event.countDocuments({ 
            date: { $lt: today }
        });
        const totalCount = await Event.countDocuments();
        const featuredCount = await Event.countDocuments({ featured: true });
        
        res.json({ 
            today: todayCount, 
            upcoming: upcomingCount, 
            past: pastCount,
            total: totalCount,
            featured: featuredCount
        });
    } catch (error) {
        console.error('Error fetching event stats:', error);
        res.status(500).json({ error: 'Failed to fetch event stats' });
    }
});

// ========== SETTINGS CRUD ==========
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await Setting.find();
        const settingsObj = {};
        settings.forEach(s => { 
            settingsObj[s.key] = { value: s.value, valueAs: s.valueAs }; 
        });
        res.json(settingsObj);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

app.put('/api/settings/:key', authMiddleware, async (req, res) => {
    try {
        const setting = await Setting.findOneAndUpdate(
            { key: req.params.key },
            { value: req.body.value, valueAs: req.body.valueAs },
            { upsert: true, new: true }
        );
        res.json(setting);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update setting' });
    }
});

// ========== DONATIONS ==========
app.get('/api/donations', authMiddleware, async (req, res) => {
    try {
        const donations = await Donation.find().sort({ date: -1 });
        res.json(donations);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

app.post('/api/donations', async (req, res) => {
    try {
        const donation = new Donation({
            ...req.body,
            status: 'completed',
            date: new Date()
        });
        await donation.save();
        res.status(201).json(donation);
    } catch (error) {
        console.error('Error recording donation:', error);
        res.status(500).json({ error: 'Failed to record donation' });
    }
});

// ========== STATISTICS ==========
app.get('/api/stats', authMiddleware, async (req, res) => {
    try {
        const memberCount = await Member.countDocuments();
        const eventCount = await Event.countDocuments();
        const donationResult = await Donation.aggregate([
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalDonations = donationResult[0]?.total || 0;
        
        const recentDonations = await Donation.find()
            .sort({ date: -1 })
            .limit(5);
        
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

// ========== ERROR HANDLING ==========
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

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
    console.log(`   GET    /api/events/upcoming`);
    console.log(`   GET    /api/events/today`);
    console.log(`   GET    /api/events/category/:category`);
    console.log(`   POST   /api/events/sync (protected) - Manual sync`);
    console.log(`   POST   /api/events (protected)`);
    console.log(`   PUT    /api/events/:id (protected)`);
    console.log(`   DELETE /api/events/:id (protected)`);
    console.log(`   GET    /api/settings`);
    console.log(`   GET    /api/donations (protected)`);
    console.log(`   POST   /api/donations`);
    console.log(`   GET    /api/stats (protected)`);
    console.log(`   GET    /api/events/stats/summary`);
    console.log(`\n🔄 Auto-update: Event categories update every hour`);
});
