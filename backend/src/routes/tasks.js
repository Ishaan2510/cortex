const express = require('express');
const Task = require('../models/Task');
const { PRESET_OPERATIONS } = require('../models/Task');
const { client: redisClient } = require('../config/redis');
const { protect } = require('../middleware/auth');
const upload = require('../config/upload');

const router = express.Router();
router.use(protect);

// Create task with optional file
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const {
      title,
      operationType,
      operation,
      customPrompt,
      inputText,
    } = req.body;

    if (!title || !operationType || !operation) {
      return res.status(400).json({
        message: 'title, operationType, and operation are required',
      });
    }

    if (operationType === 'preset' && !PRESET_OPERATIONS.includes(operation)) {
      return res.status(400).json({ message: 'Invalid preset operation' });
    }

    if (operationType === 'custom' && !customPrompt?.trim()) {
      return res.status(400).json({
        message: 'customPrompt is required for custom operations',
      });
    }

    if (!inputText?.trim() && !req.file) {
      return res.status(400).json({
        message: 'Either inputText or a file attachment is required',
      });
    }

    let fileUrl = null;
    let fileType = null;
    let filePublicId = null;

    if (req.file) {
      fileUrl = req.file.path;
      filePublicId = req.file.filename;
      fileType = req.file.mimetype === 'application/pdf' ? 'pdf' : 'image';
    }

    const task = await Task.create({
      userId: req.user.id,
      title,
      operationType,
      operation: operationType === 'custom' ? 'custom' : operation,
      customPrompt: customPrompt || null,
      inputText: inputText || null,
      fileUrl,
      fileType,
      filePublicId,
    });

    await redisClient.lPush('task_queue', task._id.toString());

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// List tasks for current user
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      Task.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v'),
      Task.countDocuments({ userId: req.user.id }),
    ]);

    res.json({ tasks, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get single task
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;