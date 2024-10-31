const express = require('express');
const http = require('http');
const bcrypt = require('bcrypt');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;
const USERS_FILE = './users.json';

app.use(express.json());
app.use(express.static('public'));  // Serve static files from the public folder

// Load and Save User Functions
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Routes
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();
  if (users[username]) {
    return res.json({ message: 'Username already exists' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  users[username] = { password: hashedPassword };
  saveUsers(users);
  res.json({ message: 'User registered successfully!' });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();
  if (!users[username] || !(await bcrypt.compare(password, users[username].password))) {
    return res.json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ username }, 'SECRET_KEY');
  res.json({ token });
});

// WebSocket Setup
io.on('connection', (socket) => {
  socket.on('message', (data) => {
    const { token, message } = data;
    try {
      const decoded = jwt.verify(token, 'SECRET_KEY');
      io.emit('message', `${decoded.username}: ${message}`);
    } catch (e) {
      console.log('Invalid token');
    }
  });
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
