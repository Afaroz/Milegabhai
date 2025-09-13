const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const nodemailer = require("nodemailer");
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const Cart = require('./models/Cart'); // ✅ NOT '../models/Cart'
require('dotenv').config();
const Product = require('./models/Product');

const userSchema = new mongoose.Schema({
  fullname: String,
  email: { type: String, unique: true },
  mobile: String,
  location: String,
  password: String,
  image: String
});
const User = mongoose.model('User', userSchema);

const app = express();
const port = process.env.PORT || 4000;

const dbURI = 'mongodb+srv://Afaroz:Afaroz%40123@cluster0.dcnjbko.mongodb.net/mydbname?retryWrites=true&w=majority';

// CORS Middleware
app.use(cors({
  origin: 'https://milegabhai.onrender.com',  // Frontend URL (make sure it's HTTPS)
  methods: ['GET', 'POST'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// File upload setup
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

const imageFilter = (req, file, cb) =>
  file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only images allowed!'), false);

const upload = multer({ storage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });

mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.log('MongoDB connection error:', err));

// Login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    res.status(200).json({
      message: 'Login successful',
      user: { fullname: user.fullname, email: user.email, mobile: user.mobile, location: user.location, image: user.image }
    });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Product Management Routes
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    const { title, price, description, condition, location, sellerPhone } = req.body;
    const imageFile = req.file;
    if (!title || !price || !description || !condition || !location || !sellerPhone || !imageFile) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const product = new Product({ title, price: Number(price), description, condition, location, sellerPhone, image: `/uploads/${imageFile.filename}` });
    const saved = await product.save();
    res.status(201).json({ message: '✅ Product saved successfully', product: saved });
  } catch (error) {
    console.error('❌ Error saving product:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const query = req.query.search;
    const filter = query ? { title: { $regex: query, $options: 'i' } } : {};
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Cart Routes
app.post('/api/cart', async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;
    if (!userId || !productId) return res.status(400).json({ message: 'Missing userId or productId' });

    const cartItem = new Cart({ userId, productId, quantity: quantity || 1 });
    const savedItem = await cartItem.save();

    res.status(201).json({
      message: '✅ Product added to cart successfully',
      cart: [savedItem]
    });
  } catch (err) {
    console.error('❌ Failed to save cart:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Start Server with HTTPS (assuming you used ngrok for local testing)
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running at https://0.0.0.0:${port}`);
});
