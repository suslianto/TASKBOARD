// server.js
require('dotenv').config();

const express = require('express');
const path = require('path');
const cron = require('node-cron');
const db = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let currentDayTasks = [];

const generateUniqueId = () => Math.random().toString(36).substr(2, 9);

const getTodayDateString = () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today.toISOString().split('T')[0];
};

const saveCurrentTasksToDb = async () => {
    const todayDate = getTodayDateString();
    console.log(`[DB SAVE] Starting full save operation for ${todayDate}...`);
    try {
        await db.sequelize.transaction(async (t) => {
            await db.Task.destroy({ where: { snapshotDate: todayDate } }, { transaction: t });

            if (currentDayTasks.length > 0) {
                const tasksToInsert = currentDayTasks.map(task => ({
                    ...task,
                    snapshotDate: todayDate
                }));
                await db.Task.bulkCreate(tasksToInsert, { transaction: t });
            }
            
            await db.DailySnapshot.upsert({ date: todayDate }, { transaction: t }); 
        });
        console.log(`[DB SAVE] Successfully completed full save for ${todayDate} to DB.`);
    } catch (error) {
        console.error('ERROR [DB SAVE]: Failed to complete full save to DB:', error);
        if (error.original && error.original.sqlMessage) {
            console.error('SQL Error Message:', error.original.sqlMessage);
        }
        throw error;
    }
};

const saveAndClearDailyTasks = async () => {
    const todayDate = getTodayDateString();
    console.log(`[Cron Job] Running daily save and clear for ${todayDate}...`);
    try {
        await saveCurrentTasksToDb();
        currentDayTasks = [];
        console.log(`[Cron Job] Cleared current tasks for ${todayDate}.`);
    } catch (error) {
        console.error(`ERROR [Cron Job]: Failed to complete daily save and clear for ${todayDate}:`, error);
    }
};

const loadTasksForToday = async () => {
    const todayDate = getTodayDateString();
    console.log(`[DB Load] Attempting to load tasks for today (${todayDate})...`);
    try {
        const loadedTasks = await db.Task.findAll({
            where: { snapshotDate: todayDate },
            raw: true
        });
        
        currentDayTasks = loadedTasks.map(task => ({
            id: task.id, title: task.title, status: task.status, type: task.type, priority: task.priority
        }));

        console.log(`[DB Load] Loaded ${currentDayTasks.length} tasks for today (${todayDate}) from DB.`);
    } catch (error) {
        console.error('ERROR [DB Load]: Failed to load tasks for today from MySQL:', error);
        currentDayTasks = [];
    }
};

db.sequelize.authenticate()
    .then(() => {
        console.log('Database connection successful!');
        return db.sequelize.sync({ alter: true });
    })
    .then(() => {
        console.log('Database tables synced.');
        loadTasksForToday();
    })
    .catch(err => {
        console.error('Unable to connect to the database or sync tables:', err);
    });

cron.schedule('59 23 * * *', saveAndClearDailyTasks, {
    timezone: "UTC"
});

cron.schedule('01 0 * * *', loadTasksForToday, {
    timezone: "UTC"
});

// --- API Routes ---

app.get('/api/tasks/current', (req, res) => { res.json(currentDayTasks); });

app.get('/api/tasks/history/:dateString', async (req, res) => {
    const dateParam = req.params.dateString;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return res.status(400).json({ message: 'Invalid date format. Use THAT-MM-DD.' });
    }

    const todayDate = getTodayDateString();

    if (dateParam === todayDate) {
        return res.json(currentDayTasks);
    }

    try {
        const snapshotTasks = await db.Task.findAll({
            where: { snapshotDate: dateParam },
            raw: true
        });
        
        const formattedTasks = snapshotTasks.map(task => ({
            id: task.id, title: task.title, status: task.status, type: task.type, priority: task.priority
        }));

        if (formattedTasks.length > 0) {
            res.json(formattedTasks);
        } else {
            const dayProcessed = await db.DailySnapshot.findByPk(dateParam);
            if (dayProcessed) {
                 res.status(200).json([]);
            } else {
                 res.status(404).json({ message: 'No tasks found or day not yet processed for this date.' });
            }
        }
    } catch (error) { console.error('Error fetching historical tasks:', error); res.status(500).json({ message: 'Server error fetching historical data.' }); }
});


app.post('/api/tasks', async (req, res) => {
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
    currentDayTasks.push(newTask);
    try {
        await saveCurrentTasksToDb(); // Save all tasks for the day (after adding new)
        res.status(201).json(newTask);
    } catch (error) { console.error('API Error: Failed to add task due to DB save error.', error); res.status(500).json({ message: 'Failed to add task due to a server error.' }); }
});

app.put('/api/tasks/:id/status', async (req, res) => {
    const taskId = req.params.id;
    const { newStatus } = req.body;
    const todayDate = getTodayDateString();

    if (!newStatus) { return res.status(400).json({ message: 'New status is required' }); }

    const taskIndex = currentDayTasks.findIndex(task => task.id === taskId);

    if (taskIndex === -1) { return res.status(404).json({ message: 'Task not found.' }); }

    currentDayTasks[taskIndex].status = newStatus;
    
    try {
        await saveCurrentTasksToDb(); // Save all tasks for the day (after updating one)
        res.json(currentDayTasks[taskIndex]);
    } catch (error) { console.error('API Error: Failed to update task status due to DB save error.', error); res.status(500).json({ message: 'Failed to update task status due to a server error.' }); }
});

app.put('/api/tasks/:id', async (req, res) => {
    const taskId = req.params.id; const { title, type, priority } = req.body; const todayDate = getTodayDateString();
    const taskIndex = currentDayTasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) { return res.status(404).json({ message: 'Task not found.' }); }
    if (title) currentDayTasks[taskIndex].title = title;
    if (type) currentDayTasks[taskIndex].type = type;
    if (priority) currentDayTasks[taskIndex].priority = priority;
    try {
        await saveCurrentTasksToDb();
        res.json(currentDayTasks[taskIndex]);
    } catch (error) { console.error('API Error: Failed to update task details due to DB save error.', error); res.status(500).json({ message: 'Failed to update task details due to a server error.' }); }
});

app.delete('/api/tasks/:id', async (req, res) => {
    const taskId = req.params.id; const initialLength = currentDayTasks.length; const todayDate = getTodayDateString();
    currentDayTasks = currentDayTasks.filter(task => task.id !== taskId);
    if (currentDayTasks.length === initialLength) { return res.status(404).json({ message: 'Task not found.' }); }
    try {
        await saveCurrentTasksToDb();
        res.status(204).send();
    } catch (error) { console.error('API Error: Failed to delete task due to DB save error.', error); res.status(500).json({ message: 'Failed to delete task due to a server error.' }); }
});

// --- API Routes for Units ---
app.get('/api/units', async (req, res) => {
    try {
        const units = await db.Unit.findAll({ order: [['orderIndex', 'ASC'], ['name', 'ASC']], raw: true });
        res.json(units.map(unit => unit.name));
    } catch (error) { console.error('Error fetching units:', error); res.status(500).json({ message: 'Error fetching units.' }); }
});
app.post('/api/units', async (req, res) => {
    const { name, orderIndex } = req.body;
    if (!name) { return res.status(400).json({ message: 'Unit name is required.' }); }
    try {
        const newUnit = await db.Unit.create({ name, orderIndex: orderIndex || 0 });
        res.status(201).json(newUnit);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') { return res.status(409).json({ message: 'Unit with this name already exists.' }); }
        console.error('Error adding unit:', error); res.status(500).json({ message: 'Error adding unit.' });
    }
});
app.delete('/api/units/:name', async (req, res) => {
    const unitName = req.params.name;
    try {
        const deletedRows = await db.Unit.destroy({ where: { name: unitName } });
        if (deletedRows > 0) { res.status(204).send(); } else { res.status(404).json({ message: 'Unit not found.' }); }
    } catch (error) { console.error('Error deleting unit:', error); res.status(500).json({ message: 'Error deleting unit.' }); }
});

app.listen(PORT, () => { console.log(`Server is running on http://localhost:${PORT}`); });