const mongoose = require('mongoose'); // <--- this line is required

const productSchema = new mongoose.Schema({
  title: String,
  price: Number,
  description: String,
  condition: String,
  location: String,
  sellerPhone: String, // ✅ This field is needed for WhatsApp
  image: String,
  createdAt: { type: Date, default: Date.now },
  likes: { type: Number, default: 0 }
});
const Product = mongoose.model('Product', productSchema);

module.exports = Product;
