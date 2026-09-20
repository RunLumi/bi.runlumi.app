import assert from 'node:assert/strict';
import test from 'node:test';
import { demo, netRevenue, contribution, contributionRate, stock, daysCover, million, percent } from '../src/data/demo.ts';

test('synthetic daily revenue reconciles exactly with the headline', () => {
  assert.equal(demo.daily.reduce((sum, row) => sum + row.amount, 0), netRevenue);
  assert.equal(netRevenue, 1_200_000_000);
});
test('contribution has a documented denominator and is not net profit', () => {
  assert.equal(contribution, 228_000_000);
  assert.equal(contributionRate, .19);
  assert.equal(million(contribution), '228');
  assert.equal(percent(contributionRate), '19%');
});
test('currency fixtures use safe integer VND, not accumulated floats', () => {
  assert.ok([demo.gross, demo.returns, ...demo.costs.map(row => row.amount), ...demo.daily.map(row => row.amount)].every(Number.isSafeInteger));
});
test('stock cover is based on disclosed inputs', () => {
  assert.deepEqual(stock.map(row => daysCover(row.onHand, row.dailyUnits)), [4, 14, 30]);
  assert.equal(stock.filter(row => (daysCover(row.onHand, row.dailyUnits) ?? Infinity) < row.leadDays).length, 1);
});
test('missing or invalid demand is unknown, not zero or infinite certainty', () => {
  assert.equal(daysCover(48, 0), null);
  assert.equal(daysCover(48, -1), null);
  assert.equal(daysCover(-1, 12), null);
  assert.equal(daysCover(NaN, 12), null);
  assert.equal(daysCover(48, Infinity), null);
  assert.equal(daysCover(0, 12), 0);
});
