import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from 'redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Serve the frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// ==========================================
// REDIS DATABASE CONNECTION
// ==========================================
const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
await redisClient.connect();
console.log('✅ Connected to Redis Database');

// Memory Array
let activeTargets = [];

// Boot Sequence: Pull saved data from cloud
const savedData = await redisClient.get('targetState');
if (savedData) {
    activeTargets = JSON.parse(savedData);
    console.log('💾 Restored Target Calculator memory from Database!');
}

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. Send all saved coins to the frontend
app.get('/api/targets', (req, res) => {
    res.json(activeTargets);
});

// 2. Add a new coin or update an existing one (e.g., switching Long/Short)
app.post('/api/targets', async (req, res) => {
    const { id, symbol, fixedValue, direction } = req.body;
    
    const existingIndex = activeTargets.findIndex(c => c.id === id);
    if (existingIndex >= 0) {
        activeTargets[existingIndex] = { id, symbol, fixedValue, direction };
    } else {
        activeTargets.push({ id, symbol, fixedValue, direction });
    }

    // Save to Redis
    await redisClient.set('targetState', JSON.stringify(activeTargets));
    res.status(200).send("OK");
});

// 3. Delete a coin setup
app.delete('/api/targets/:id', async (req, res) => {
    const id = req.params.id; // Kept as string to match Date.now() ID
    activeTargets = activeTargets.filter(c => c.id !== id);
    
    // Save to Redis
    await redisClient.set('targetState', JSON.stringify(activeTargets));
    res.status(200).send("OK");
});

app.listen(PORT, () => {
    console.log(`Target Calculator running on port ${PORT}`);
});
