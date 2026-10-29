import test from 'node:test';
import assert from 'node:assert/strict';
import { mentionSuggestions, mentionToken, mentionsUser } from '../src/canvas/comments/mentions.js';
import { toChatEntry } from '../src/canvas/canvasChat.js';

test('mentions use the full nickname and tag, including spaces', () => {
  const user = { nickname: 'test user', tag_number: 12 };
  assert.equal(mentionToken(user), '@test user#12');
  assert.equal(mentionsUser('안녕 @test user#12!', user), true);
  assert.equal(mentionsUser('@test user#123', user), false);
  assert.equal(mentionsUser('mail@test user#12', user), false);
});

test('suggestions replace the active mention and distinguish duplicate nicknames', () => {
  const participants = [{ nickname: 'kim', tag_number: 1 }, { nickname: 'kim', tag_number: 2 }, { nickname: 'lee', tag_number: 1 }];
  const result = mentionSuggestions('hello @ki!', 9, participants);
  assert.equal(result.start, 6);
  assert.deepEqual(result.matches.map(mentionToken), ['@kim#1', '@kim#2']);
  assert.equal(mentionSuggestions('mail@ki', 7, participants), null);
});

test('chat and distinct object threads produce distinct message targets', () => {
  const message = { sequence: 5, sender: 'kim', tag_number: 1, text: 'hello', created_at: 100 };
  assert.notEqual(toChatEntry(message, {}).id, toChatEntry({ ...message, object_id: 'x' }, {}).id);
  assert.notEqual(toChatEntry({ ...message, object_id: 'x' }, {}).id, toChatEntry({ ...message, object_id: 'y' }, {}).id);
});
