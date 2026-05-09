const express = require('express');
const Task = require('../models/Task');
const { client: redisClient } = require('../config/redis');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Create task
router.post('/', async (req, res) => {
  try {
    const { title, inputText, operation } = req.body;
    if (!title || !inputText || !operation)
      return res.status(400).json({ message: 'title, inputText, and operation are required' });

    const task = await Task.create({
      userId: req.user.id,
      title,
      inputText,
      operation,
    });

    // Push task ID to Redis queue
    await redisClient.lPush('task_queue', task._id.toString());

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// List all tasks for current user
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .select('-__v');
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get single task
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;