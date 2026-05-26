const Task = require('../models/Task');
const { routeAndStream } = require('./llmRouter');
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

    // Stream tokens. We accumulate them locally for the final DB write, and
    // forward each chunk to the event bus as it arrives so subscribed
    // EventSource clients see live output.
    //
    // accumulatedResult is the source of truth for what the client sees. On
    // a provider_switch we reset it because the new provider starts from
    // scratch, and we want the DB write to match what the user saw.
    let accumulatedResult = '';
    let finalProvider = null;
    let finalAttempted = [];

    for await (const event of routeAndStream({
      systemPrompt, userMessage, operation, inputLength, hasImage, imageData,
    })) {
      if (event.type === 'token') {
        accumulatedResult += event.text;
        eventBus.emit(taskId, 'token', { text: event.text, provider: event.provider });
      } else if (event.type === 'provider_switch') {
        accumulatedResult = '';
        logs.push(`${ts()} Provider ${event.from} failed mid-stream, switching to ${event.to}`);
        eventBus.emit(taskId, 'provider_switch', { from: event.from, to: event.to });
      } else if (event.type === 'complete') {
        finalProvider = event.provider;
        finalAttempted = event.attempted;
      }
    }

    logs.push(`${ts()} Completed using provider: ${finalProvider}`);
    if (finalAttempted.length > 1) {
      logs.push(`${ts()} Fallback chain used: ${finalAttempted.join(' -> ')}`);
    }

    await Task.findByIdAndUpdate(taskId, {
      status: 'success',
      result: accumulatedResult,
      providerUsed: finalProvider,
      providerChain: finalAttempted,
      logs,
    });
    eventBus.emit(taskId, 'complete', {
      status: 'success',
      result: accumulatedResult,
      providerUsed: finalProvider,
      providerChain: finalAttempted,
      logs,
    });
    console.log(`Task ${taskId} completed via ${finalProvider}`);
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