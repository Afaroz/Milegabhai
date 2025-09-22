const mongoose = require('mongoose');
mongoose.set('debug', true);


const userSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobile: { type: String, required: true },
  location: String,
  password: { type: String, required: true },
    image: String, // ✅ optional
    imagePublicId: String,
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
