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
const { CloudinaryStorage } = require('multer-storage-cloudinary');
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
// ✅ CORS - Enable communication between frontend & backend
app.use(cors({
  origin: 'https://milegabhai.vercel.app',
  methods: ['GET', 'POST'],
  credentials: true // Only if you're using cookies/sessions
}));

// ✅ MongoDB Connection
const dbURI = process.env.MONGODB_URI;
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

const profileUpload = multer({ storage });

// Define storage for products
const productStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'product_images',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    public_id: (req, file) => 'product_' + Date.now(),
  },
});

// Create multer upload instance for products

// ✅ Local multer storage
const upload = multer({ dest: 'uploads/' });
const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'profile_images',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    public_id: (req, file) => 'profile_' + Date.now(),
  },
});


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










app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    const { title, price, description, condition, location, sellerPhone } = req.body;
    const imageFile = req.file;

    if (!title || !price || !description || !condition || !location || !sellerPhone || !imageFile) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Upload image to Cloudinary
    const result = await cloudinary.uploader.upload(imageFile.path, {
      folder: 'products'
    });

    // Delete local image file only if it's a local path, not a URL
    if (imageFile.path && !imageFile.path.startsWith('http')) {
      fs.unlinkSync(imageFile.path);
    }

    // Save product info with Cloudinary image URL
    const product = new Product({
      title,
      price: Number(price),
      description,
      condition,
      location,
      sellerPhone,
      image: result.secure_url
    });

    const saved = await product.save();
    res.status(201).json({ message: 'Product saved successfully', product: saved });

  } catch (error) {
    console.error('Error saving product:', error);
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














// ✅ Upload Profile Image API Route
app.post('/api/uploadProfileImage', profileUpload.single('profileImage'), async (req, res) => {
  try {
    const email = req.body.email;
    const file = req.file;

    console.log('Email:', email);
    console.log('File:', file);

    if (!email || !file) {
      return res.status(400).json({ success: false, message: 'Email and image file are required' });
    }

    const imageUrl = file.path; // Cloudinary image URL

    const updatedUser = await User.findOneAndUpdate(
      { email },
      { image: imageUrl },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Image uploaded to Cloudinary',
      imageUrl,
      user: updatedUser,
    });
  } catch (error) {
    console.error('❌ Error uploading profile image:', error.stack || error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});



const bcrypt = require('bcryptjs');
const User = require('./models/User'); // adjust path if needed

app.post('/api/register', async (req, res) => {
  try {
    const { fullname, email, mobile, location, password } = req.body;

    // Validate required fields
    if (!fullname || !email || !mobile || !location || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      fullname,
      email,
      mobile,
      location,
      password: hashedPassword,
      image: ''
    });

    await newUser.save();

    console.log('✅ User Registered:', newUser.email);

    return res.json({ message: 'Registration successful' });

  } catch (err) {
    console.error('❌ Registration Error:', err);
    return res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
});





// DELETE product and Cloudinary image
app.delete('/api/products/:id', async (req, res) => {
  const id = req.params.id;

  console.log("🗑️ DELETE request received for ID:", id);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  try {
    // 1️⃣ Find the product by ID
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // 2️⃣ Delete image from Cloudinary
    if (product.image) {
      // Extract public_id from Cloudinary URL
      const match = product.image.match(/\/upload\/(?:v\d+\/)?(.+)\.(jpg|jpeg|png|webp|gif)$/i);
      const publicId = match && match[1] ? match[1] : null;

      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log('✅ Cloudinary image deleted:', publicId);
        } catch (cloudErr) {
          console.error('⚠️ Cloudinary image delete error:', cloudErr.message);
        }
      } else {
        console.warn('⚠️ Could not extract public_id from image URL:', product.image);
      }
    }

    // 3️⃣ Delete the product from MongoDB
    await Product.findByIdAndDelete(id);

    res.json({ message: '✅ Product and image deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting product:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



app.delete('/api/users/deleteByEmail', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Delete user image from Cloudinary
    if (user.image) {
      const match = user.image.match(/\/upload\/(?:v\d+\/)?(.+)\.(jpg|png|jpeg|gif|webp)$/i);
      const publicId = match ? match[1] : null;

      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log(`Deleted user image: ${publicId}`);
        } catch (err) {
          console.error('Error deleting user image:', err);
        }
      }
    }

    // Delete user's products and their images
    const userMobile = user.mobile;
    if (userMobile) {
      const products = await Product.find({ sellerPhone: userMobile }); // Match correct field!

      for (const product of products) {
        if (product.image) {
          const match = product.image.match(/\/upload\/(?:v\d+\/)?(.+)\.(jpg|png|jpeg|gif|webp)$/i);
          const publicId = match ? match[1] : null;

          if (publicId) {
            try {
              await cloudinary.uploader.destroy(publicId);
              console.log(`Deleted product image: ${publicId}`);
            } catch (err) {
              console.error('Error deleting product image:', err);
            }
          }
        }
      }

      // Delete all products by seller phone
      await Product.deleteMany({ sellerPhone: userMobile });
    }

    // Delete user
    await User.deleteOne({ email });

    res.json({ message: '✅ User, products, and images deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
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
