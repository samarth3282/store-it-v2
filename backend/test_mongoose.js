import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true },
    otpHash: { type: String, select: false },
    otpExpiry: { type: Date, select: false },
  }
);

const User = mongoose.model('User', userSchema);

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/storeit_test');
  
  // Clean
  await User.deleteMany({});

  // Simulate register
  const u1 = await User.create({ email: 'test@test.com', otpHash: 'hash1', otpExpiry: new Date() });
  console.log('After register, DB document:', await mongoose.connection.db.collection('users').findOne({ _id: u1._id }));

  // Simulate verifyOtp
  let found = await User.findById(u1._id).select('+otpHash +otpExpiry');
  found.otpHash = undefined;
  found.otpExpiry = undefined;
  await found.save();
  console.log('After verifyOtp (undefined), DB document:', await mongoose.connection.db.collection('users').findOne({ _id: u1._id }));

  // Simulate login
  let found2 = await User.findOne({ email: 'test@test.com' }).select('+otpHash +otpExpiry');
  found2.otpHash = 'hash2';
  found2.otpExpiry = new Date();
  await found2.save();
  console.log('After login (assigned), DB document:', await mongoose.connection.db.collection('users').findOne({ _id: u1._id }));

  process.exit(0);
})();
