const express = require('express');
const Task = require('../models/Task');
const { PRESET_OPERATIONS } = require('../models/Task');
const { processTask } = require('../services/taskProcessor');
const { protect, protectCookie } = require('../middleware/auth');
const upload = require('../config/upload');
const eventBus = require('../services/eventBus');

const router = express.Router();

// SSE endpoint must come BEFORE router.use(protect), since it uses cookie auth.
// Standard task endpoints continue to use Bearer-header auth via router.use.

/**
 * Server-Sent Events stream for a single task's lifecycle.
 *
 * Why this endpoint exists:
 *   The frontend used to poll GET /api/tasks/:id every 3s while a task ran.
 *   That wasted bandwidth on idle polls and gave a clunky UX. SSE lets us
 *   push updates the moment they happen, including live LLM tokens.
 *
 * Why cookie auth instead of Bearer:
 *   EventSource is the browser API for SSE. It does not let JavaScript set
 *   custom headers, so the standard Authorization: Bearer flow does not
 *   work. We use a separate httpOnly session cookie set at login time.
 *
 * Why we emit an immediate snapshot:
 *   A client may connect after the task has already started, or even after
 *   it completed. The event bus drops events that fire before subscribers
 *   attach, so we read the current state from MongoDB and send it first.
 *
 * Why keep-alive comments:
 *   Render's free-tier proxy closes idle connections after ~30s of silence.
 *   An SSE comment (a line starting with `:`) is a valid heartbeat that
 *   does not trigger client-side events.
 */
router.get('/:id/stream', protectCookie, async (req, res) => {
  const taskId = req.params.id;

  // Verify the task exists and belongs to this user before opening the stream.
  // Otherwise an attacker who guessed task IDs could subscribe to others' streams.
  const task = await Task.findOne({ _id: taskId, userId: req.user.id });
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx-style buffering if any proxy adds it
  res.flushHeaders();

  const send = (eventType, payload) => {
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // Snapshot first, so the client has current state regardless of when it connected.
  send('snapshot', {
    status: task.status,
    result: task.result || '',
    providerUsed: task.providerUsed || null,
    providerChain: task.providerChain || [],
    logs: task.logs || [],
  });

  // If the task is already terminal, close immediately. No point holding a
  // connection open for a task that has nothing more to say.
  if (task.status === 'success' || task.status === 'failed') {
    send('end', { reason: 'already_terminal' });
    return res.end();
  }

  // Subscribe to live events. The unsubscribe function is invoked on cleanup.
  const unsubscribe = eventBus.subscribe(taskId, ({ type, data }) => {
    send(type, data);
    if (type === 'complete' || type === 'error') {
      // We do not call res.end() here. The client closes the EventSource on
      // its 'complete' or 'error' handler, which fires our 'close' listener
      // below. Doing both leads to "write after end" warnings.
    }
  });

  // Heartbeat to keep the connection alive through proxies.
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  // Clean up when the client disconnects (close button, navigation, network drop).
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// Everything below this line requires a Bearer token (existing behavior).
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

    processTask(task._id.toString()).catch(err => {
      console.error('processTask crashed:', err);
    });

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