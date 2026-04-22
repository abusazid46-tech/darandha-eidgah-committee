// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
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
        'https://darandha-eidgah-committee.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/darandha_eidgah';
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ========== SCHEMAS ==========

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

// Event Schema
const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    titleAs: String,
    description: String,
    descriptionAs: String,
    date: Date,
    image: String,
    type: { type: String, default: 'event' },
    createdAt: { type: Date, default: Date.now },
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

// Admin Schema with refresh token support
const adminSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    email: String,
    role: { type: String, default: 'admin', enum: ['super_admin', 'admin', 'editor'] },
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
// Ensure uploads directory exists
const fs = require('fs');
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
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
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// ========== AUTH MIDDLEWARE ==========
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ 
            error: 'Access denied. No token provided.',
            message: 'Please login to access this resource'
        });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token expired',
                message: 'Please login again'
            });
        }
        return res.status(403).json({ 
            error: 'Invalid token',
            message: 'Authentication failed'
        });
    }
};

// ========== DATABASE INITIALIZATION ==========
async function initDatabase() {
    try {
        // Create default admin if not exists
        const adminExists = await Admin.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await Admin.create({ 
                username: 'admin', 
                password: hashedPassword,
                role: 'super_admin'
            });
            console.log('✅ Default admin created (username: admin, password: admin123)');
        }

        // Create default settings if not exists
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
                console.log(`✅ Default setting created: ${setting.key}`);
            }
        }
        
        console.log('✅ Database initialization complete');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// Call initialization
initDatabase();

// ========== API ROUTES ==========

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Darandha Eidgah API is running',
        timestamp: new Date().toISOString()
    });
});

// ========== AUTHENTICATION ROUTES ==========

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                error: 'Username and password required' 
            });
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
        
        // Update last login
        admin.lastLogin = new Date();
        await admin.save();
        
        // Generate token
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify token endpoint
app.get('/api/auth/verify', authMiddleware, async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin.id).select('-password');
        res.json({ 
            valid: true, 
            user: admin 
        });
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
        const member = new Member(req.body);
        await member.save();
        res.status(201).json(member);
    } catch (error) {
        res.status(400).json({ error: 'Failed to create member' });
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
        res.status(400).json({ error: 'Failed to update member' });
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
        res.status(500).json({ error: 'Failed to delete member' });
    }
});

// ========== EVENTS CRUD ==========

// Get all events (public)
app.get('/api/events', async (req, res) => {
    try {
        const events = await Event.find().sort({ date: -1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch events' });
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
        res.status(500).json({ error: 'Failed to fetch event' });
    }
});

// Create event (protected)
app.post('/api/events', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        const eventData = JSON.parse(req.body.data);
        if (req.file) {
            eventData.image = `/uploads/${req.file.filename}`;
        }
        const event = new Event(eventData);
        await event.save();
        res.status(201).json(event);
    } catch (error) {
        console.error('Event creation error:', error);
        res.status(400).json({ error: 'Failed to create event' });
    }
});

// Update event (protected)
app.put('/api/events/:id', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        const eventData = JSON.parse(req.body.data);
        if (req.file) {
            eventData.image = `/uploads/${req.file.filename}`;
        }
        const event = await Event.findByIdAndUpdate(
            req.params.id, 
            eventData, 
            { new: true, runValidators: true }
        );
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json(event);
    } catch (error) {
        res.status(400).json({ error: 'Failed to update event' });
    }
});

// Delete event (protected)
app.delete('/api/events/:id', authMiddleware, async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete event' });
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
        res.status(400).json({ error: 'Failed to update setting' });
    }
});

// ========== DONATIONS ==========

// Get all donations (protected)
app.get('/api/donations', authMiddleware, async (req, res) => {
    try {
        const donations = await Donation.find().sort({ date: -1 });
        res.json(donations);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch donations' });
    }
});

// Create donation (public)
app.post('/api/donations', async (req, res) => {
    try {
        const donation = new Donation({
            ...req.body,
            status: 'completed'
        });
        await donation.save();
        res.status(201).json(donation);
    } catch (error) {
        res.status(400).json({ error: 'Failed to record donation' });
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
        
        res.json({ 
            memberCount, 
            eventCount, 
            totalDonations,
            recentDonations: await Donation.find().sort({ date: -1 }).limit(5)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ========== ERROR HANDLING MIDDLEWARE ==========

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 API URL: http://localhost:${PORT}/api`);
    console.log(`🔐 JWT Secret: ${JWT_SECRET ? 'Configured ✅' : 'Missing ❌'}`);
    console.log(`💾 MongoDB: ${MONGODB_URI}`);
});
