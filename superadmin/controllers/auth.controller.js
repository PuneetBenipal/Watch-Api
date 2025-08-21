const User = require("../../models/User.model");
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ state: 'error', msg: `Email doesn't exists.` });
        }
        // Check password
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({ state: 'error', msg: 'Password is not matched' });
        }

        // Generate token
        const token = jwt.sign({ ...user.toJSON() }, process.env.JWT_SECRET);

        // Return user data without password
        const userResponse = user.toJSON();

        res.json({
            message: 'Login successful',
            token,
            user: userResponse,
            next: "/dashboard"
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ state: 'error', msg: 'Login failed' });
    }
};