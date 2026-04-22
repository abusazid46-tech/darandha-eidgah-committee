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

// ========== SCHEMAS ==========
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
    date: { type: Date, default: Date.now },
    image: String,
    type: { type: String, default: 'event' },
    createdAt: { type: Date, default: Date.now },
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
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
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
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
};

// ========== DATABASE INITIALIZATION ==========
async function initDatabase() {
    try {
        const adminExists = await Admin.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await Admin.create({ 
                username: 'admin', 
                password: hashedPassword,
                role: 'super_admin'
            });
            console.log('✅ Default admin created (admin/admin123)');
        }

        const defaultSettings = [
            { key: 'whatsapp_number', value: '+919876543210' },
            { key: 'contact_email', value: 'info@darandhaeidgah.org' },
            { key: 'contact_phone', value: '+91 98765 43210' },
            { key: 'about_content', value: 'Darandha Eidgah Committee is dedicated to serving the Muslim community.' },
            { key: 'about_content_as', value: 'দৰংদহ ঈদগাহ কমিটিয়ে মুছলমান সমাজক সেৱা আগবঢ়োৱাত নিয়োজিত।' },
        ];

        for (const setting of defaultSettings) {
            const exists = await Setting.findOne({ key: setting.key });
            if (!exists) await Setting.create(setting);
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
    res.json({ status: 'OK', message: 'API is running', timestamp: new Date().toISOString() });
});

// Auth
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const valid = await bcrypt.compare(password, admin.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: admin._id, username: admin.username, role: admin.role }, 
            JWT_SECRET, 
            { expiresIn: '7d' }
        );
        
        res.json({ token, username: admin.username, role: admin.role });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Verify token
app.get('/api/auth/verify', authMiddleware, async (req, res) => {
    res.json({ valid: true, user: req.admin });
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
        res.status(500).json({ error: 'Failed to update member' });
    }
});

app.delete('/api/members/:id', authMiddleware, async (req, res) => {
    try {
        const member = await Member.findByIdAndDelete(req.params.id);
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        res.json({ success: true, message: 'Member deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete member' });
    }
});

// ========== EVENTS CRUD ==========
app.get('/api/events', async (req, res) => {
    try {
        const events = await Event.find().sort({ date: -1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

app.post('/api/events', authMiddleware, async (req, res) => {
    try {
        console.log('Received event data:', req.body);
        
        const { title, titleAs, description, descriptionAs, date, type } = req.body;
        
        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }
        
        const event = new Event({
            title,
            titleAs: titleAs || '',
            description: description || '',
            descriptionAs: descriptionAs || '',
            date: date || new Date(),
            type: type || 'event',
            createdAt: new Date()
        });
        
        await event.save();
        console.log('Event saved:', event);
        res.status(201).json(event);
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event: ' + error.message });
    }
});

app.put('/api/events/:id', authMiddleware, async (req, res) => {
    try {
        const event = await Event.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true, runValidators: true }
        );
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update event' });
    }
});

app.delete('/api/events/:id', authMiddleware, async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json({ success: true, message: 'Event deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

// ========== SETTINGS ==========
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await Setting.find();
        const settingsObj = {};
        settings.forEach(s => { settingsObj[s.key] = { value: s.value, valueAs: s.valueAs }; });
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
        const donation = new Donation(req.body);
        await donation.save();
        res.status(201).json(donation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to record donation' });
    }
});

// ========== STATS ==========
app.get('/api/stats', authMiddleware, async (req, res) => {
    try {
        const memberCount = await Member.countDocuments();
        const eventCount = await Event.countDocuments();
        const donationResult = await Donation.aggregate([
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalDonations = donationResult[0]?.total || 0;
        
        res.json({ memberCount, eventCount, totalDonations });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 API URL: http://localhost:${PORT}/api`);
});
