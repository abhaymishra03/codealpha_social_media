require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const dns = require('dns');
dns.setServers(['8.8.8.8']);
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 50 },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9_]{3,20}$/ },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  bio: { type: String, default: '', maxlength: 180 },
  avatar: { type: String, default: '' },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 500 }
}, { timestamps: true });
const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  image: { type: String, default: '', maxlength: 1000 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [commentSchema]
}, { timestamps: true });
const Post = mongoose.model('Post', postSchema);

function tokenFor(user) { return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' }); }
function publicUser(user) {
  return { id: user._id, name: user.name, username: user.username, bio: user.bio, avatar: user.avatar,
    followersCount: user.followers?.length || 0, followingCount: user.following?.length || 0 };
}
function auth(required = true) {
  return (req, res, next) => {
    const value = req.headers.authorization || '';
    const token = value.startsWith('Bearer ') ? value.slice(7) : '';
    if (!token) return required ? res.status(401).json({ error: 'Please sign in to continue.' }) : next();
    try { req.userId = jwt.verify(token, process.env.JWT_SECRET).id; next(); }
    catch { return res.status(401).json({ error: 'Your session has expired. Please sign in again.' }); }
  };
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.post('/api/auth/register', wrap(async (req, res) => {
  const { name, username, email, password } = req.body;
  if (!name || !username || !email || !password) return res.status(400).json({ error: 'Please fill in every field.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!/^[a-z0-9_]{3,20}$/i.test(username)) return res.status(400).json({ error: 'Username must be 3–20 letters, numbers, or underscores.' });
  const exists = await User.findOne({ $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] });
  if (exists) return res.status(409).json({ error: 'That username or email is already in use.' });
  const user = await User.create({ name, username, email, password: await bcrypt.hash(password, 12) });
  res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase() }).select('+password');
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  res.json({ token: tokenFor(user), user: publicUser(user) });
}));

app.get('/api/auth/me', auth(), wrap(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  res.json({ user: publicUser(user) });
}));

app.get('/api/posts', auth(false), wrap(async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 }).limit(60).populate('author', 'name username avatar').populate('comments.author', 'name username avatar');
  res.json({ posts: posts.map(p => ({ ...p.toObject(), liked: !!req.userId && p.likes.some(id => id.toString() === req.userId) })) });
}));

app.post('/api/posts', auth(), wrap(async (req, res) => {
  const text = (req.body.text || '').trim();
  const image = (req.body.image || '').trim();
  if (!text) return res.status(400).json({ error: 'Write something before sharing.' });
  const post = await Post.create({ author: req.userId, text, image });
  await post.populate('author', 'name username avatar');
  res.status(201).json({ post });
}));

app.post('/api/posts/:id/like', auth(), wrap(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  const index = post.likes.findIndex(id => id.toString() === req.userId);
  if (index === -1) post.likes.push(req.userId); else post.likes.splice(index, 1);
  await post.save();
  res.json({ liked: index === -1, likesCount: post.likes.length });
}));

app.post('/api/posts/:id/comments', auth(), wrap(async (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Write a comment first.' });
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  post.comments.push({ author: req.userId, text });
  await post.save();
  await post.populate('comments.author', 'name username avatar');
  res.status(201).json({ comment: post.comments[post.comments.length - 1] });
}));

app.get('/api/users/:username', auth(false), wrap(async (req, res) => {
  const user = await User.findOne({ username: req.params.username.toLowerCase() });
  if (!user) return res.status(404).json({ error: 'Profile not found.' });
  const posts = await Post.find({ author: user._id }).sort({ createdAt: -1 }).limit(30).populate('author', 'name username avatar').populate('comments.author', 'name username avatar');
  res.json({ user: publicUser(user), isFollowing: !!req.userId && user.followers.some(id => id.toString() === req.userId), posts });
}));

app.post('/api/users/:id/follow', auth(), wrap(async (req, res) => {
  if (req.params.id === req.userId) return res.status(400).json({ error: 'You cannot follow yourself.' });
  const [target, me] = await Promise.all([User.findById(req.params.id), User.findById(req.userId)]);
  if (!target || !me) return res.status(404).json({ error: 'User not found.' });
  const index = target.followers.findIndex(id => id.equals(me._id));
  if (index === -1) { target.followers.push(me._id); me.following.push(target._id); }
  else { target.followers.splice(index, 1); me.following.pull(target._id); }
  await Promise.all([target.save(), me.save()]);
  res.json({ following: index === -1, followersCount: target.followers.length });
}));

app.get('/api/users', auth(), wrap(async (req, res) => {
  const users = await User.find({ _id: { $ne: req.userId } }).sort({ createdAt: -1 }).limit(12);
  res.json({ users: users.map(u => ({ ...publicUser(u), isFollowing: u.followers.some(id => id.toString() === req.userId) })) });
}));

app.patch('/api/profile', auth(), wrap(async (req, res) => {
  const { name, bio, avatar } = req.body;
  const user = await User.findByIdAndUpdate(req.userId, { $set: { name: (name || '').trim().slice(0, 50), bio: (bio || '').trim().slice(0, 180), avatar: (avatar || '').trim().slice(0, 500) } }, { new: true, runValidators: true });
  res.json({ user: publicUser(user) });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'That endpoint was not found.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.name === 'ValidationError' ? 'Please check the information you entered.' : 'Something went wrong. Please try again.' });
});

const port = process.env.PORT || 3000;
if (!process.env.JWT_SECRET) { console.error('Missing JWT_SECRET. Copy .env.example to .env and set a secret.'); process.exit(1); }
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://abhay_mishra_03:a1b2h3a4y5@cluster0.msod9hq.mongodb.net/social_media_app')
  .then(() => app.listen(port, () => console.log(`Social Media App is running at http://localhost:${port}`)))
  .catch(err => { console.error('Could not connect to MongoDB:', err.message); process.exit(1); });
