const mongoose = require('mongoose');

const PRESET_OPERATIONS = [
  'summarize',
  'extract_action_items',
  'rewrite_formal',
  'rewrite_casual',
  'generate_linkedin_post',
  'draft_email',
  'extract_key_decisions',
  'explain_simply',
  'generate_tweet_thread',
  'translate_hindi',
];

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    operationType: {
      type: String,
      enum: ['preset', 'custom'],
      required: true,
    },
    operation: {
      type: String,
      enum: [...PRESET_OPERATIONS, 'custom'],
      required: true,
    },
    customPrompt: {
      type: String,
      default: null,
    },
    inputText: {
      type: String,
      default: null,
    },
    fileUrl: {
      type: String,
      default: null,
    },
    fileType: {
      type: String,
      enum: ['pdf', 'image', null],
      default: null,
    },
    filePublicId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'success', 'failed'],
      default: 'pending',
      index: true,
    },
    result: {
      type: String,
      default: null,
    },
    providerUsed: {
      type: String,
      default: null,
    },
    providerChain: {
      type: [String],
      default: [],
    },
    logs: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

taskSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Task', taskSchema);
module.exports.PRESET_OPERATIONS = PRESET_OPERATIONS;