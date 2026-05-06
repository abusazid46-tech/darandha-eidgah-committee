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

// FIXED: Donation Schema with approval status (declared only once)
const donationSchema = new mongoose.Schema({
    name: String,
    amount: Number,
    date: { type: Date, default: Date.now },
    transactionId: String,
    status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
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
        
        await Event.updateMany(
            { date: { $gte: todayStart, $lte: todayEnd }, status: 'active' },
            { category: 'today' }
        );
        
        await Event.updateMany(
            { date: { $gt: todayEnd }, status: 'active' },
            { category: 'upcoming' }
        );
        
        await Event.updateMany(
            { date: { $lt: todayStart }, status: 'active' },
            { category: 'past' }
        );
        
        await Event.updateMany(
            { status: { $in: ['cancelled', 'completed'] } },
            { category: 'past' }
        );
        
        console.log('✅ Event categories auto-updated at:', new Date().toLocaleString());
    } catch (error) {
        console.error('❌ Auto-update error:', error);
    }
}

setInterval(autoUpdateEventCategories, 60 * 60 * 1000);
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
        timestamp: new Date().toISOString()
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
        if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
        if (!admin.isActive) return res.status(401).json({ error: 'Account is deactivated' });
        
        const valid = await bcrypt.compare(password, admin.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        
        admin.lastLogin = new Date();
        await admin.save();
        
        const token = jwt.sign(
            { id: admin._id, username: admin.username, role: admin.role }, 
            JWT_SECRET, 
            { expiresIn: '7d' }
        );
        
        res.json({ success: true, token, username: admin.username, role: admin.role });
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
        if (!name) return res.status(400).json({ error: 'Name is required' });
        
        const member = new Member({ name, nameAs: nameAs || '', phone: phone || '', address: address || '', role: role || 'Member', joinDate: new Date(), status: 'active' });
        await member.save();
        res.status(201).json(member);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create member: ' + error.message });
    }
});

app.put('/api/members/:id', authMiddleware, async (req, res) => {
    try {
        const member = await Member.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
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

// ========== EVENTS CRUD ==========
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
        
        res.json(await eventsQuery);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

app.get('/api/events/upcoming', async (req, res) => {
    try {
        await autoUpdateEventCategories();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const events = await Event.find({ date: { $gte: today }, status: 'active', category: { $in: ['today', 'upcoming'] } }).sort({ date: 1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch upcoming events' });
    }
});

app.get('/api/events/today', async (req, res) => {
    try {
        await autoUpdateEventCategories();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const events = await Event.find({ date: { $gte: today, $lt: tomorrow }, status: 'active' }).sort({ time: 1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch today\'s events' });
    }
});

app.get('/api/events/category/:category', async (req, res) => {
    try {
        await autoUpdateEventCategories();
        const { category } = req.params;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        let query = {};
        let sortOrder = {};
        
        switch(category) {
            case 'today':
                query = { date: { $gte: today, $lt: tomorrow }, status: 'active' };
                sortOrder = { time: 1 };
                break;
            case 'upcoming':
                query = { date: { $gt: tomorrow }, status: 'active' };
                sortOrder = { date: 1 };
                break;
            case 'past':
                query = { date: { $lt: today } };
                sortOrder = { date: -1 };
                break;
            default:
                query = {};
                sortOrder = { date: -1 };
        }
        
        const events = await Event.find(query).sort(sortOrder);
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

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

app.post('/api/events', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        let eventData = req.body.data ? JSON.parse(req.body.data) : req.body;
        if (!eventData.title) return res.status(400).json({ error: 'Title is required' });
        if (!eventData.date) return res.status(400).json({ error: 'Date is required' });
        
        if (req.file) {
            eventData.image = `/uploads/${req.file.filename}`;
            eventData.imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }
        
        const eventDate = new Date(eventData.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (eventDate.toDateString() === today.toDateString()) eventData.category = 'today';
        else if (eventDate > today) eventData.category = 'upcoming';
        else eventData.category = 'past';
        
        const event = new Event(eventData);
        await event.save();
        await autoUpdateEventCategories();
        res.status(201).json(event);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create event: ' + error.message });
    }
});

app.put('/api/events/:id', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        let eventData = req.body.data ? JSON.parse(req.body.data) : req.body;
        
        if (req.file) {
            const oldEvent = await Event.findById(req.params.id);
            if (oldEvent && oldEvent.image) {
                const oldImagePath = path.join(__dirname, oldEvent.image);
                if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
            }
            eventData.image = `/uploads/${req.file.filename}`;
            eventData.imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }
        
        const eventDate = new Date(eventData.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (eventData.status === 'cancelled' || eventData.status === 'completed') eventData.category = 'past';
        else if (eventDate.toDateString() === today.toDateString()) eventData.category = 'today';
        else if (eventDate > today) eventData.category = 'upcoming';
        else eventData.category = 'past';
        
        const event = await Event.findByIdAndUpdate(req.params.id, eventData, { new: true, runValidators: true });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        
        await autoUpdateEventCategories();
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update event: ' + error.message });
    }
});

app.delete('/api/events/:id', authMiddleware, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });
        
        if (event.image) {
            const imagePath = path.join(__dirname, event.image);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        }
        
        await Event.findByIdAndDelete(req.params.id);
        await autoUpdateEventCategories();
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

app.post('/api/events/sync', authMiddleware, async (req, res) => {
    try {
        await autoUpdateEventCategories();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        res.json({ 
            success: true, 
            message: 'Events synchronized successfully',
            stats: { 
                today: await Event.countDocuments({ date: { $gte: today, $lt: tomorrow }, status: 'active' }),
                upcoming: await Event.countDocuments({ date: { $gt: tomorrow }, status: 'active' }),
                past: await Event.countDocuments({ date: { $lt: today } })
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to sync events' });
    }
});

app.get('/api/events/stats/summary', async (req, res) => {
    try {
        await autoUpdateEventCategories();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        res.json({ 
            today: await Event.countDocuments({ date: { $gte: today, $lt: tomorrow }, status: 'active' }),
            upcoming: await Event.countDocuments({ date: { $gt: tomorrow }, status: 'active' }),
            past: await Event.countDocuments({ date: { $lt: today } }),
            total: await Event.countDocuments(),
            featured: await Event.countDocuments({ featured: true })
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch event stats' });
    }
});

app.get('/api/events/past', async (req, res) => {
    try {
        await autoUpdateEventCategories();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const events = await Event.find({ date: { $lt: today } }).sort({ date: -1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch past events' });
    }
});

// ========== SETTINGS CRUD ==========
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

// ========== DONATIONS WITH APPROVAL SYSTEM ==========
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
            name: req.body.name,
            amount: req.body.amount,
            transactionId: req.body.transactionId || '',
            status: 'pending',
            date: new Date()
        });
        await donation.save();
        res.status(201).json({ success: true, message: 'Donation recorded. Awaiting admin approval.', donation });
    } catch (error) {
        console.error('Error recording donation:', error);
        res.status(500).json({ error: 'Failed to record donation' });
    }
});

app.put('/api/donations/:id/approve', authMiddleware, async (req, res) => {
    try {
        const donation = await Donation.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
        if (!donation) return res.status(404).json({ error: 'Donation not found' });
        res.json({ success: true, message: 'Donation approved', donation });
    } catch (error) {
        res.status(500).json({ error: 'Failed to approve donation' });
    }
});

app.put('/api/donations/:id/reject', authMiddleware, async (req, res) => {
    try {
        const donation = await Donation.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
        if (!donation) return res.status(404).json({ error: 'Donation not found' });
        res.json({ success: true, message: 'Donation rejected', donation });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reject donation' });
    }
});
// ========== ADMIN PROFILE MANAGEMENT ==========

// Change password endpoint
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const adminId = req.admin.id;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current password and new password are required' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }
        
        // Find admin
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }
        
        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, admin.password);
        if (!isValid) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        admin.password = hashedPassword;
        await admin.save();
        
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ message: 'Failed to change password' });
    }
});

// Update admin email
app.put('/api/auth/update-email', authMiddleware, async (req, res) => {
    try {
        const { email } = req.body;
        const adminId = req.admin.id;
        
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }
        
        admin.email = email;
        await admin.save();
        
        res.json({ success: true, message: 'Email updated successfully' });
    } catch (error) {
        console.error('Email update error:', error);
        res.status(500).json({ message: 'Failed to update email' });
    }
});

// Get admin profile
app.get('/api/auth/profile', authMiddleware, async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin.id).select('-password -refreshToken');
        res.json(admin);
    } catch (error) {
        res.status(500).json({ message: 'Failed to get profile' });
    }
});
// ========== STATISTICS ==========
app.get('/api/stats', authMiddleware, async (req, res) => {
    try {
        const memberCount = await Member.countDocuments();
        const eventCount = await Event.countDocuments();
        const donationResult = await Donation.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
        const totalDonations = donationResult[0]?.total || 0;
        const recentDonations = await Donation.find({ status: 'approved' }).sort({ date: -1 }).limit(5);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcomingEvents = await Event.countDocuments({ date: { $gt: today }, status: 'active' });
        
        res.json({ memberCount, eventCount, totalDonations, upcomingEvents, recentDonations });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.get('/api/stats/public', async (req, res) => {
    try {
        const memberCount = await Member.countDocuments();
        const eventCount = await Event.countDocuments();
        const donationResult = await Donation.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
        const totalDonations = donationResult[0]?.total || 0;
        
        res.json({ memberCount, eventCount, totalDonations });
    } catch (error) {
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
        if (err.code === 'FILE_TOO_LARGE') return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error', message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong' });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 API URL: http://localhost:${PORT}/api`);
    console.log(`🔐 JWT Secret: ${JWT_SECRET ? 'Configured ✅' : 'Missing ❌'}`);
    console.log(`💾 MongoDB: ${MONGODB_URI.includes('localhost') ? 'Local ✅' : 'Atlas ✅'}`);
});
