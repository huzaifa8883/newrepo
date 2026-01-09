const express = require('express');
const nodemailer = require('nodemailer');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const app = express();
const PORT = 3000;

// 1. Parsing aur CORS
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ================ MongoDB Connection ================
mongoose.connect('mongodb+srv://huzaifa:huzaifa56567@cluster0.owmq7.mongodb.net')
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// =================== GrowWebsite User Schema ===================
const growUserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
    epin: { type: String, required: true },
    image: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// Model for collection 'growwebsite'
const GrowUser = mongoose.model('GrowUser', growUserSchema, 'growwebsite');

// ================ Multer for Image Upload ================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

app.use(cors({
    origin: ['https://saloonparlour.com/'],
    credentials: true,
}));

// 2. Session
app.use(session({
    secret: 'secretkey123',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 600000 }
}));

// ✅ Verification store
const verificationStore = {};

// 3. Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'qhuzaifa675@gmail.com',
        pass: 'ctmt ylst dhiu bmip'
    }
});

// 4. Routes
app.get('/test', async (req, res) => {
    let nodemailerStatus = 'Failed ❌';
    try {
        await transporter.verify();
        nodemailerStatus = 'Working ✅';
    } catch (err) {}

    res.json({ success: true, nodemailer: nodemailerStatus });
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

// VERIFY CODE
app.post('/verify', (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ success: false, message: 'Missing data' });
    }

    if (verificationStore[email] == code) {
        delete verificationStore[email];
        return res.json({ success: true });
    }

    res.status(401).json({ success: false, message: 'Invalid code' });
});

// REGISTER → SEND CODE
app.post('/register', (req, res) => {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, message: 'Valid email required' });
    }

    const code = Math.floor(100000 + Math.random() * 900000);
    verificationStore[email] = code;

    const mailOptions = {
        from: 'qhuzaifa675@gmail.com',
        to: email,
        subject: 'Verification Code',
        text: `Your code: ${code}\nValid for 10 minutes.`
    };

    transporter.sendMail(mailOptions, (error) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ success: false });
        }

        console.log('Code sent:', email, code);
        res.json({ success: true });
    });
});

app.get('/signup', (req, res) => {
    if (!req.session.verified) {
        return res.redirect('/register.html');
    }
    res.sendFile(path.join(__dirname, 'signup.html'));
});

// POST Final Signup - Save to growwebsite collection
app.post('/signup', upload.single('image'), async (req, res) => {
    const { firstname, password, password_confirmation, epin, email } = req.body;
    const image = req.file ? req.file.filename : null;

    // Validation
    if (!firstname || !password || !epin || !email) {
        return res.status(400).json({ success: false, message: 'All fields required' });
    }
    if (password !== password_confirmation) {
        return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be 6+ characters' });
    }

    try {
        // Check if email already exists
        const existingUser = await GrowUser.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save to growwebsite collection
        const newUser = new GrowUser({
            email,
            name: firstname,
            password: hashedPassword,
            epin,
            image
        });

        await newUser.save();
        console.log('✅ New user saved to growwebsite:', { email, name: firstname, image });

        res.json({ success: true, message: 'Profile completed & account created successfully!' });
    } catch (error) {
        console.error('MongoDB Save Error:', error);
        res.status(500).json({ success: false, message: 'Server error, try again' });
    }
});
app.get('/user/:email', async (req, res) => {
    const { email } = req.params;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    try {
        const user = await GrowUser.findOne({ email }).select('-password'); // password hide kar diya
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, user });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
// Static files
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
