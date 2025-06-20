// server.js
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Middleware untuk melayani file statis dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Data tugas sementara (in-memory)
let tasks = [
    { id: '1', title: 'Trouble SLA', status: 'Backlog', type: 'bug', priority: 'high' },
    { id: '2', title: 'Default backlog task', status: 'Backlog', type: 'feature', priority: 'low' },
    { id: '3', title: 'Default ongoing task', status: 'Ongoing', type: 'bug', priority: 'medium' },
    { id: '4', title: 'Default done task', status: 'Done', type: 'refactor', priority: 'high' }
];

const generateUniqueId = () => Math.random().toString(36).substr(2, 9);

// --- ROUTES API ---
app.get('/api/tasks', (req, res) => {
    res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
    const { title, status, type, priority } = req.body;
    if (!title || !status || !type || !priority) {
        return res.status(400).json({ message: 'Title, status, type, and priority are required' });
    }
    const newTask = {
        id: generateUniqueId(),
        title,
        status,
        type,
        priority
    };
    tasks.push(newTask);
    res.status(201).json(newTask);
});

app.put('/api/tasks/:id/status', (req, res) => {
    const taskId = req.params.id;
    const { newStatus } = req.body;

    const taskIndex = tasks.findIndex(task => task.id === taskId);

    if (taskIndex === -1) {
        return res.status(404).json({ message: 'Task not found' });
    }
    if (!newStatus) {
        return res.status(400).json({ message: 'New status is required' });
    }

    tasks[taskIndex].status = newStatus;
    res.json(tasks[taskIndex]);
});

app.put('/api/tasks/:id', (req, res) => {
    const taskId = req.params.id;
    const { title, type, priority } = req.body; // Status tidak diupdate dari sini

    const taskIndex = tasks.findIndex(task => task.id === taskId);

    if (taskIndex === -1) {
        return res.status(404).json({ message: 'Task not found' });
    }

    if (title) tasks[taskIndex].title = title;
    if (type) tasks[taskIndex].type = type;
    if (priority) tasks[taskIndex].priority = priority;

    res.json(tasks[taskIndex]);
});

app.delete('/api/tasks/:id', (req, res) => {
    const taskId = req.params.id;
    const initialLength = tasks.length;
    tasks = tasks.filter(task => task.id !== taskId);

    if (tasks.length === initialLength) {
        return res.status(404).json({ message: 'Task not found' });
    }
    res.status(204).send();
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});