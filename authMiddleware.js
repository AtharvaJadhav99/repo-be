const jwt = require('jsonwebtoken');
const secretKey = require('./secret');

function verifyToken(req, res, next) {
    const token = req.header('Authorization').split(' ')[1];
    // console.log(req.headers)
    // console.log(token)
    if (!token) 
        return res.status(401).json({ error: 'Access denied' });
    try {
        // console.log('hello')
        // console.log('secret key in authMiddleware.js : ', secretKey);
        const decoded = jwt.verify(token, secretKey);
        // console.log('decoded:', decoded)
        req.userId = decoded.userId;
        next();
    } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
    }
 };

module.exports = verifyToken;