// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'darandha_eidgah_secret_key_2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/darandha_eidgah', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Schemas
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
  date: Date,
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
  username: { type: String, unique: true },
  password: String,
});

// Models
const Member = mongoose.model('Member', memberSchema);
const Event = mongoose.model('Event', eventSchema);
const Setting = mongoose.model('Setting', settingSchema);
const Donation = mongoose.model('Donation', donationSchema);
const Admin = mongoose.model('Admin', adminSchema);

// Image upload setup
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Initialize default admin and settings
async function initDatabase() {
  const adminExists = await Admin.findOne({ username: 'admin' });
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await Admin.create({ username: 'admin', password: hashedPassword });
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
    if (!exists) await Setting.create(setting);
  }
}
initDatabase();

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ========== API ROUTES ==========

// Auth
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: admin._id, username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username });
});

// Members CRUD
app.get('/api/members', async (req, res) => {
  const members = await Member.find().sort({ name: 1 });
  res.json(members);
});

app.post('/api/members', authMiddleware, async (req, res) => {
  const member = new Member(req.body);
  await member.save();
  res.json(member);
});

app.put('/api/members/:id', authMiddleware, async (req, res) => {
  const member = await Member.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(member);
});

app.delete('/api/members/:id', authMiddleware, async (req, res) => {
  await Member.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Events CRUD
app.get('/api/events', async (req, res) => {
  const events = await Event.find().sort({ date: -1 });
  res.json(events);
});

app.post('/api/events', authMiddleware, upload.single('image'), async (req, res) => {
  const eventData = JSON.parse(req.body.data);
  if (req.file) eventData.image = `/uploads/${req.file.filename}`;
  const event = new Event(eventData);
  await event.save();
  res.json(event);
});

app.put('/api/events/:id', authMiddleware, upload.single('image'), async (req, res) => {
  const eventData = JSON.parse(req.body.data);
  if (req.file) eventData.image = `/uploads/${req.file.filename}`;
  const event = await Event.findByIdAndUpdate(req.params.id, eventData, { new: true });
  res.json(event);
});

app.delete('/api/events/:id', authMiddleware, async (req, res) => {
  await Event.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Settings
app.get('/api/settings', async (req, res) => {
  const settings = await Setting.find();
  const settingsObj = {};
  settings.forEach(s => { settingsObj[s.key] = { value: s.value, valueAs: s.valueAs }; });
  res.json(settingsObj);
});

app.put('/api/settings/:key', authMiddleware, async (req, res) => {
  const setting = await Setting.findOneAndUpdate(
    { key: req.params.key },
    { value: req.body.value, valueAs: req.body.valueAs },
    { upsert: true, new: true }
  );
  res.json(setting);
});

// Donations
app.get('/api/donations', authMiddleware, async (req, res) => {
  const donations = await Donation.find().sort({ date: -1 });
  res.json(donations);
});

app.post('/api/donations', async (req, res) => {
  const donation = new Donation(req.body);
  await donation.save();
  res.json(donation);
});

// Stats for dashboard
app.get('/api/stats', authMiddleware, async (req, res) => {
  const memberCount = await Member.countDocuments();
  const eventCount = await Event.countDocuments();
  const donations = await Donation.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);
  res.json({ memberCount, eventCount, totalDonations: donations[0]?.total || 0 });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
