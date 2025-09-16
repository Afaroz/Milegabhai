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

// Mongo models (user schema remains)
const userSchema = new mongoose.Schema({
  fullname: String,
  email: { type: String, unique: true },
  mobile: String,
  location: String,
  password: String,
  image: String
});


require('dotenv').config();



const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Models
const User = mongoose.model('User', userSchema); // Assuming userSchema is defined above or imported
const app = express();
const PORT = process.env.PORT || 4000;

// ✅ Serve static files for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// ✅ Serve static files (like .html, .css, .js) from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ CORS - Enable communication between frontend & backend
app.use(cors({
  origin: 'https://milegabhai.onrender.com',
  methods: ['GET', 'POST'],
  credentials: true // Only if you're using cookies/sessions
}));

// ✅ MongoDB Connection
const dbURI = 'mongodb+srv://Afaroz:Afaroz%40123@cluster0.dcnjbko.mongodb.net/myappdb?retryWrites=true&w=majority';
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Multer storage using Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  folder: 'profile_images',
  allowedFormats: ['jpg', 'jpeg', 'png'],
});

// Image filter to accept images only
const imageFilter = (req, file, cb) => 
  file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only images allowed!'), false);




// Login
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



// Product management route with Cloudinary upload
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    const { title, price, description, condition, location, sellerPhone } = req.body;
    const imageFile = req.file;

    if (!title || !price || !description || !condition || !location || !sellerPhone || !imageFile) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // 🔼 Upload image to Cloudinary
    const result = await cloudinary.uploader.upload(imageFile.path, {
      folder: 'products' // optional folder in Cloudinary
    });

    // 🔄 Delete local image file after upload (optional)
    fs.unlinkSync(imageFile.path);

    // 💾 Save product with Cloudinary image URL
    const product = new Product({
      title,
      price: Number(price),
      description,
      condition,
      location,
      sellerPhone,
      image: result.secure_url  // ✅ This is the Cloudinary image URL
    });

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
    console.log('🔍 Search query:', query || 'none');
    console.log('📦 Filter used:', filter);

    const products = await Product.find(filter).sort({ createdAt: -1 });

    console.log(`🧾 Found ${products.length} products`);
    res.json(products);
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    console.error('❌ Error fetching product by ID:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/cart', async (req, res) => {
  try {
    console.log('💬 Request Body:', req.body);
    const { userId, productId, quantity } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({ message: 'Missing userId or productId' });
    }

    const cartItem = new Cart({
      userId,
      productId,
      quantity: quantity || 1
    });

    const savedItem = await cartItem.save(); // 💾 THIS saves to MongoDB

    res.status(201).json({
      message: '✅ Product added to cart successfully',
      cart: [savedItem]
    });
  } catch (err) {
    console.error('❌ Failed to save cart:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/cart', async (req, res) => {
  const userEmail = req.query.email;

  if (!userEmail) {
    return res.status(400).json({ message: 'Email query parameter is required' });
  }

  try {
    // Find all cart items belonging to this user
    const cartItems = await Cart.find({ userId: userEmail }).lean();

    if (!cartItems.length) {
      return res.json([]);  // Empty cart
    }

    // Fetch full product info for each cart item
    const detailedCart = await Promise.all(
      cartItems.map(async (item) => {
        if (!mongoose.Types.ObjectId.isValid(item.productId)) {
          console.warn('Invalid productId:', item.productId);
          return null;
        }

        const product = await Product.findById(item.productId).lean();
        if (!product) {
          console.warn('Product not found for ID:', item.productId);
          return null;
        }

        return {
          product,
          quantity: item.quantity,
        };
      })
    );

    // Remove any null results (invalid/missing products)
    const filteredCart = detailedCart.filter(item => item !== null);

    res.json(filteredCart);

  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/cart', async (req, res) => {
  const { email, productId } = req.query;

  if (!email || !productId) {
    return res.status(400).json({ message: 'Missing email or productId' });
  }

  try {
    const deletedItem = await Cart.findOneAndDelete({
      userId: email,
      productId: productId
    });

    if (!deletedItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    res.json({ message: 'Product removed from cart' });
  } catch (error) {
    console.error('Error deleting cart item:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});















app.post('/api/uploadProfileImage', profileUpload.single('profileImage'), async (req, res) => {
  try {
    const email = req.body.email;
    const file = req.file;

    console.log('Email:', email);
    console.log('File:', file);

    if (!email || !file) {
      return res.status(400).json({ success: false, message: 'Email and image file are required' });
    }

    const imagePath = file.path;

    const updatedUser = await User.findOneAndUpdate({ email }, { image: imagePath }, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'Image uploaded', imageUrl: imagePath, user: updatedUser });
  } catch (error) {
    console.error('❌ Error uploading profile image:', error.stack || error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});














// In-memory store for OTPs and pending registrations
// Structure: {
//    "<email>": { otp: "123456", expires: Date, regData: { fullname, email, mobile, location, password } }
// }
const pendingRegs = {};

function generateOTP(length = 6) {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,  // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// API to initiate registration and send OTP
app.post('/api/send-otp', async (req, res) => {
  try {
    const { fullname, email, mobile, location, password } = req.body;
    if (!fullname || !email || !mobile || !location || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const otp = generateOTP(6);
    const expires = new Date(Date.now() + (Number(process.env.OTP_EXPIRY_MINUTES) * 60 * 1000));

    // Save pending registration
    pendingRegs[email] = {
      otp,
      expires,
      regData: { fullname, email, mobile, location, password }
    };

    // Send OTP email
    await transporter.sendMail({
      from: `"No-Reply" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is ${otp}. It will expire in ${process.env.OTP_EXPIRY_MINUTES} minutes.`,
      html: `<p>Your OTP code is <b>${otp}</b>. It will expire in ${process.env.OTP_EXPIRY_MINUTES} minutes.</p>`
    });

    return res.json({ message: 'OTP sent' });
  } catch (err) {
    console.error('Error in /api/send-otp:', err);
    return res.status(500).json({ message: 'Error sending OTP' });
  }
});

app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const pending = pendingRegs[email];
    if (!pending) {
      return res.status(400).json({ message: 'No OTP request found for this email' });
    }

    if (pending.expires < new Date()) {
      delete pendingRegs[email];
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if (pending.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // ✅ Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      delete pendingRegs[email];
      return res.status(409).json({ message: 'Email is already registered' });
    }

    const { fullname, mobile, location, password } = pending.regData;
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullname,
      email,
      mobile,
      location,
      password: hashedPassword,
      image: ''
    });

    await newUser.save();

    console.log('✅ User registered:', newUser);

    delete pendingRegs[email];

    return res.json({ message: 'Registration successful' });

  } catch (err) {
    console.error('❌ Error in /api/verify-otp:', err);
    return res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
});

// DELETE route
app.delete('/api/products/:id', async (req, res) => {
  const id = req.params.id;

  console.log("DELETE request received for ID:", id);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  try {
    const result = await Product.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Server error' });
  }
});








app.listen(PORT, '0.0.0.0')
  .on('listening', () => {
    console.log(`🚀 Server running at https://0.0.0.0:${PORT}`);
  })
  .on('error', (err) => {
    console.error('Server failed to start:', err);
  });
