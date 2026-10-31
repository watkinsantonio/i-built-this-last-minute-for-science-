'use strict';
// Live Poll core: no HTTP, no DOM. One poll at a time, one vote per voter (a voter may change their vote).

class PollError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PollError';
    this.status = status;
  }
}

const MAX_QUESTION = 200;
const MAX_OPTION = 80;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;
const MAX_VOTER_ID = 64;
const MAX_VOTERS = 5000;

function cleanText(value, max, what) {
  if (typeof value !== 'string' || !value.trim()) throw new PollError(what + ' is required');
  const text = value.trim();
  if (text.length > max) throw new PollError(what + ' must be at most ' + max + ' characters');
  return text;
}

class Poll {
  constructor(question, options) {
    this.question = cleanText(question, MAX_QUESTION, 'Question');
    if (!Array.isArray(options) || options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
      throw new PollError('Provide between ' + MIN_OPTIONS + ' and ' + MAX_OPTIONS + ' options');
    }
    this.options = options.map((o) => cleanText(o, MAX_OPTION, 'Option'));
    const lower = this.options.map((o) => o.toLowerCase());
    if (new Set(lower).size !== lower.length) throw new PollError('Options must be different from each other');
    this.votes = new Map(); // voterId -> option index
  }

  vote(voterId, optionIndex) {
    if (typeof voterId !== 'string' || !voterId || voterId.length > MAX_VOTER_ID) {
      throw new PollError('voter must be a non-empty string up to ' + MAX_VOTER_ID + ' characters');
    }
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= this.options.length) {
      throw new PollError('option must be the number of one of the choices');
    }
    if (!this.votes.has(voterId) && this.votes.size >= MAX_VOTERS) throw new PollError('This poll is full', 429);
    this.votes.set(voterId, optionIndex);
  }

  results() {
    const counts = this.options.map(() => 0);
    for (const index of this.votes.values()) counts[index]++;
    const total = this.votes.size;
    return {
      question: this.question,
      total,
      options: this.options.map((label, i) => ({
        label,
        votes: counts[i],
        percent: total ? Math.round((counts[i] / total) * 100) : 0,
      })),
    };
  }
}

module.exports = { Poll, PollError };
