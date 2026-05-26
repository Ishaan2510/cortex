/**
 * Process-local event bus for task lifecycle events.
 *
 * Each task gets its own EventEmitter, so subscribers only see events for
 * the task they care about. Emitters are garbage-collected when the last
 * subscriber leaves, so memory does not grow with task count.
 *
 * Design note: events emitted before any subscriber attaches are dropped.
 * This is intentional. The SSE endpoint reads the current task state from
 * MongoDB when it connects, so it has the snapshot it needs without us
 * having to buffer events here.
 *
 * The kubernetes branch will swap this single-process implementation for a
 * Redis pub/sub-backed one (channel: `task_updates:{taskId}`), preserving
 * this exact interface so callers do not need to change.
 */
const EventEmitter = require('events');

class TaskEventBus {
  constructor() {
    this.emitters = new Map();
  }

  emit(taskId, type, data) {
    const e = this.emitters.get(taskId);
    if (e) e.emit('event', { type, data, ts: Date.now() });
  }

  subscribe(taskId, handler) {
    let e = this.emitters.get(taskId);
    if (!e) {
      e = new EventEmitter();
      e.setMaxListeners(20);
      this.emitters.set(taskId, e);
    }
    e.on('event', handler);

    return () => {
      e.off('event', handler);
      if (e.listenerCount('event') === 0) {
        this.emitters.delete(taskId);
      }
    };
  }
}

module.exports = new TaskEventBus();