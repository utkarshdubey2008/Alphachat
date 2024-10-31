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

// Load users from JSON file
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

// Save users to JSON file
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Serve HTML with embedded CSS and JS
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Chat App</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; }
        #chat-box { width: 300px; height: 400px; border: 1px solid #ccc; overflow-y: auto; padding: 10px; }
        #message { width: 240px; }
        #messages { list-style: none; padding: 0; }
      </style>
    </head>
    <body>
      <h2>Chat Application</h2>
      <input type="text" id="username" placeholder="Username">
      <input type="password" id="password" placeholder="Password">
      <button onclick="signup()">Sign Up</button>
      <button onclick="login()">Log In</button>

      <div id="chat" style="display:none;">
        <div id="chat-box">
          <ul id="messages"></ul>
        </div>
        <input id="message" placeholder="Type a message...">
        <button onclick="sendMessage()">Send</button>
      </div>

      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        let token = '';

        function signup() {
          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;
          fetch('/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          }).then(res => res.json()).then(data => alert(data.message));
        }

        function login() {
          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;
          fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          }).then(res => res.json()).then(data => {
            if (data.token) {
              token = data.token;
              document.getElementById('chat').style.display = 'block';
            } else {
              alert(data.message);
            }
          });
        }

        function sendMessage() {
          const message = document.getElementById('message').value;
          socket.emit('message', { token, message });
          document.getElementById('message').value = '';
        }

        socket.on('message', data => {
          const messages = document.getElementById('messages');
          const msgElem = document.createElement('li');
          msgElem.textContent = data;
          messages.appendChild(msgElem);
        });
      </script>
    </body>
    </html>
  `);
});

// Handle Signup
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

// Handle Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();
  if (!users[username] || !(await bcrypt.compare(password, users[username].password))) {
    return res.json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ username }, 'SECRET_KEY');
  res.json({ token });
});

// WebSocket for real-time chat
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
