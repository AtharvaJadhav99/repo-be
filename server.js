const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// const crypto = require('crypto');
const verifyToken = require('./authMiddleware');
const secretKey = require('./secret');

const app = express();
const PORT = process.env.PORT || 8081;

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

const db = mysql.createConnection({
    host: "localhost",
    port: 8889,
    user: "root",
    password: "root",
    database: "music_library"
});

// const secretKey = crypto.randomBytes(32).toString('hex');

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Signup endpoint
app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Store user in database
        const sql = "INSERT INTO user (email, password) VALUES (?, ?)";
        db.query(sql, [email, hashedPassword], (err, result) => {
            if (err) {
                console.error('Error executing SQL query:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            console.log('User signed up successfully');
            res.status(201).json({ message: 'User signed up successfully' });
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login endpoint
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    // Find user by email
    const sql = "SELECT * FROM user WHERE email = ?";
    db.query(sql, [email], async (err, result) => {
        if (err) {
            console.error('Error executing SQL query:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        if (result.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result[0];

        // Compare passwords
        try {
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            console.log('secret key in server.js : ', secretKey);

            const token = jwt.sign({ userId: user.id, email: user.email }, secretKey);
            res.status(200).json({ "message": "User authenticated", token })

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
});

app.get('/api/music', (req, res) => {
    const sql = "SELECT * FROM Tracks";
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error executing SQL query:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        return res.json(result);
    });
});

// Creating a playlist
app.post('/api/create-playlists', verifyToken, (req, res) => {
    const { playlistName } = req.body;
    const userId = req.userId;

    if (!playlistName) {
        return res.status(400).json({ error: 'Playlist name is required' });
    }

    const sql = 'INSERT INTO playlists (playlist_name, user_id) VALUES (?, ?)';

    db.query(sql, [playlistName, userId], (err, result) => {
        if (err) {
            console.error('Error executing SQL query:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.status(201).json({ message: 'Playlist created successfully', playlistId: result.insertId });
    });
});

// Fetch playlists for the current user
app.get('/api/playlists', verifyToken, (req, res) => {
    const userId = req.userId; // Assuming user ID is encoded in the token
    console.log(userId)
    const sql = "SELECT * FROM playlists WHERE user_id = ?";
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Error executing SQL query:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(results);
    });
});

// Add a track to a playlist
app.post('/api/playlists/add-track', verifyToken, (req, res) => {
    const { playlistId, trackId } = req.body;
    console.log('playlistId : ', playlistId)
    console.log('trackId : ', trackId)
    // Check if both playlistId and trackId are provided
    if (!playlistId || !trackId) {
        return res.status(400).json({ error: 'Both playlistId and trackId are required' });
    }

    // Insert the track into the playlist_tracks table
    const sql = "INSERT INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)";
    db.query(sql, [playlistId, trackId], (err, result) => {
        if (err) {
            console.error('Error executing SQL query:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.status(201).json({ message: 'Track added to playlist successfully' });
    });
});

// Get all tracks for a playlist
app.get('/api/playlists/tracks/:playlistId', verifyToken, (req, res) => {
    const playlistId = req.params.playlistId;

    // Retrieve all track information associated with the given playlist ID
    const sql = `
        SELECT t.*
        FROM Tracks t
        INNER JOIN playlist_tracks pt ON t.TrackId = pt.track_id
        WHERE pt.playlist_id = ?
    `;
    db.query(sql, [playlistId], (err, results) => {
        if (err) {
            console.error('Error executing SQL query:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.status(200).json({ playlistId, tracks: results });
    });
});

// Delete a playlist
app.delete('/api/playlists/:playlistId', verifyToken, (req, res) => {
    const playlistId = req.params.playlistId;

    // Delete entries from the playlist_tracks table where playlist_id matches
    const deletePlaylistTracksSql = 'DELETE FROM playlist_tracks WHERE playlist_id = ?';
    db.query(deletePlaylistTracksSql, [playlistId], (err, result) => {
        if (err) {
            console.error('Error deleting playlist tracks:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        // Delete the playlist from the playlist table
        const deletePlaylistSql = 'DELETE FROM playlists WHERE playlist_id = ?';
        db.query(deletePlaylistSql, [playlistId], (err, result) => {
            if (err) {
                console.error('Error deleting playlist:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            res.status(200).json({ message: 'Playlist deleted successfully' });
        });
    });
});

// Delete a track from a playlist
app.delete('/api/deleteTrack', verifyToken, (req, res) => {
    const { trackId, playlistId } = req.body;

    // Delete the track from the playlist_tracks table
    const deleteTrackSql = 'DELETE FROM playlist_tracks WHERE track_id = ? AND playlist_id = ?';
    db.query(deleteTrackSql, [trackId, playlistId], (err, result) => {
        if (err) {
            console.error('Error deleting track:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.status(200).json({ message: 'Track deleted successfully' });
    });
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
