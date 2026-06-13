'use strict';

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  room: {
    type: String,
    required: true,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.Mixed, // userId string or ObjectId
    required: true,
  },
  senderName: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    default: '',
    maxlength: 10000,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'system', 'emoji'],
    default: 'text',
  },
  fileUrl: {
    type: String,
  },
  fileName: {
    type: String,
  },
  fileSize: {
    type: Number,
  },
  isDM: {
    type: Boolean,
    default: false,
  },
  readBy: {
    type: [String],
    default: [],
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  reactions: [{
    emoji: String,
    users: [String],
  }],
  isEdited: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

messageSchema.index({ room: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ isDM: 1, room: 1 });

// Soft-delete virtual
messageSchema.virtual('displayContent').get(function () {
  return this.isDeleted ? '[This message was deleted]' : this.content;
});

messageSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Message', messageSchema);
