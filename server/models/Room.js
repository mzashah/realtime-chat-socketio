'use strict';

const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    unique: true,
  },
  description: {
    type: String,
    maxlength: 500,
    default: '',
  },
  type: {
    type: String,
    enum: ['public', 'private', 'dm'],
    default: 'public',
  },
  createdBy: {
    type: String,
    required: true,
  },
  members: {
    type: [String],
    default: [],
  },
  admins: {
    type: [String],
    default: [],
  },
  avatar: {
    type: String,
  },
  isArchived: {
    type: Boolean,
    default: false,
  },
  lastMessage: {
    content:   { type: String },
    sender:    { type: String },
    timestamp: { type: Date },
  },
  maxMembers: {
    type: Number,
    default: 1000,
  },
  settings: {
    slowMode:        { type: Boolean, default: false },
    slowModeInterval:{ type: Number, default: 0 },
    onlyAdminsCanPost: { type: Boolean, default: false },
  },
}, {
  timestamps: true,
});

roomSchema.index({ name: 1 });
roomSchema.index({ type: 1, isArchived: 1 });
roomSchema.index({ members: 1 });

roomSchema.virtual('memberCount').get(function () {
  return this.members.length;
});

roomSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Room', roomSchema);
