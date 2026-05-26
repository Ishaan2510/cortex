const Task = require('../models/Task');
const { routeAndCall } = require('./llmRouter');
const { getSystemPrompt, getOperationLabel } = require('./operations');
const { extractPdfText, getImageData } = require('./fileProcessor');
const eventBus = require('./eventBus');

const ts = () => `[${new Date().toISOString()}]`;

async function processTask(taskId) {
  const task = await Task.findById(taskId);
  if (!task) {
    console.error(`Task ${taskId} not found`);
    return;
  }

  const logs = [`${ts()} Task picked up by backend processor`];
  const operation = task.operation || 'custom';
  const operationLabel = getOperationLabel(operation);

  await Task.findByIdAndUpdate(taskId, { status: 'running', logs });
  eventBus.emit(taskId, 'progress', { status: 'running', logs });

  try {
    const userMessageParts = [];
    let imageData = null;
    let hasImage = false;

    if (task.fileUrl && task.fileType === 'pdf') {
      logs.push(`${ts()} Extracting text from PDF`);
      await Task.findByIdAndUpdate(taskId, { logs });
      eventBus.emit(taskId, 'progress', { logs });
      const pdfText = await extractPdfText(task.fileUrl);
      logs.push(`${ts()} PDF extracted (${pdfText.length} characters)`);
      userMessageParts.push(`[PDF Content]\n${pdfText}`);
    } else if (task.fileUrl && task.fileType === 'image') {
      logs.push(`${ts()} Loading image for processing`);
      await Task.findByIdAndUpdate(taskId, { logs });
      eventBus.emit(taskId, 'progress', { logs });
      imageData = await getImageData(task.fileUrl);
      hasImage = true;
      userMessageParts.push('[An image has been provided. Please process it as instructed.]');
    }

    if (task.inputText) {
      userMessageParts.push(`[Text Input]\n${task.inputText}`);
    }

    const userMessage = userMessageParts.join('\n\n');
    const inputLength = userMessage.length;
    const systemPrompt = getSystemPrompt(operation, task.customPrompt);

    logs.push(`${ts()} Running operation: ${operationLabel}`);
    logs.push(`${ts()} Input length: ${inputLength} characters`);
    await Task.findByIdAndUpdate(taskId, { logs });
    eventBus.emit(taskId, 'progress', { logs });

    const { result, attempted } = await routeAndCall({
      systemPrompt, userMessage, operation, inputLength, hasImage, imageData,
    });

    const providerUsed = attempted[attempted.length - 1];
    logs.push(`${ts()} Completed using provider: ${providerUsed}`);
    if (attempted.length > 1) {
      logs.push(`${ts()} Fallback chain used: ${attempted.join(' -> ')}`);
    }

    await Task.findByIdAndUpdate(taskId, {
      status: 'success',
      result,
      providerUsed,
      providerChain: attempted,
      logs,
    });
    eventBus.emit(taskId, 'complete', {
      status: 'success',
      result,
      providerUsed,
      providerChain: attempted,
      logs,
    });
    console.log(`Task ${taskId} completed via ${providerUsed}`);
  } catch (err) {
    logs.push(`${ts()} ERROR: ${err.message}`);
    await Task.findByIdAndUpdate(taskId, { status: 'failed', logs });
    eventBus.emit(taskId, 'error', { status: 'failed', logs, message: err.message });
    console.error(`Task ${taskId} failed:`, err);
  }
}

// Run on startup — Render's free tier cold-starts can leave tasks orphaned
async function sweepStuckTasks() {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const stuck = await Task.find({
    status: { $in: ['pending', 'running'] },
    updatedAt: { $lt: tenMinAgo },
  });
  for (const task of stuck) {
    await Task.findByIdAndUpdate(task._id, {
      status: 'failed',
      $push: { logs: `${ts()} Task marked failed on restart (was stuck in ${task.status})` },
    });
  }
  if (stuck.length > 0) console.log(`Swept ${stuck.length} stuck tasks on startup`);
}

module.exports = { processTask, sweepStuckTasks };