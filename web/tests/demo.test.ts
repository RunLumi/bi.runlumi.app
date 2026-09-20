import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenarios, chartPoints } from '../src/data/demo.ts';

test('seven daily revenue points reconcile to gross less returns, not profit', () => {
  const money = scenarios.find(s => s.id === 'money')!;
  const netVnd = money.series.reduce((sum, value) => sum + value * 1_000_000, 0);
  assert.equal(netVnd, 512_000_000 - 26_000_000);
  assert.equal(money.metrics[0].value, new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1 }).format(netVnd / 1_000_000));
  assert.equal(money.metrics[2].unknown, true);
  assert.equal(money.metrics[2].value, 'Chưa đủ dữ liệu');
  assert.match(money.limit, /Không tính lãi đóng góp/);
});
test('open exception stock is not weekly incident flow', () => {
  const ops = scenarios.find(s => s.id === 'operations')!;
  assert.equal(ops.series.reduce((a, b) => a + b, 0), 57);
  assert.equal(Number(ops.metrics[0].value), 24);
  assert.ok(Number(ops.metrics[1].value) <= Number(ops.metrics[0].value));
  assert.match(ops.definition, /không phải tổng phát sinh/);
});
test('all scenarios have bounded, correctly plotted independent fixtures and evidence', () => {
  assert.equal(new Set(scenarios.map(s => s.id)).size, 3);
  for (const s of scenarios) {
    assert.equal(s.series.length, 7);
    assert.ok(s.series.every(n => Number.isFinite(n) && n >= 0 && n <= s.ceiling));
    assert.ok(s.source && s.definition && s.limit && s.caveat);
    const points = chartPoints(s.series, s.ceiling).split(' ').map(point => point.split(',').map(Number));
    assert.equal(points.length, 7);
    for (const [index, [x, y]] of points.entries()) {
      assert.equal(x, 48 + index * 84);
      assert.ok(y >= 40 && y <= 188);
      assert.ok(Math.abs((188 - y) * s.ceiling / 148 - s.series[index]) < 1e-10);
    }
  }
});
test('stale inventory is not a demand forecast or an automatic purchase', () => {
  const stock = scenarios.find(s => s.id === 'stock')!;
  assert.equal(stock.metrics[2].value, '2');
  assert.match(stock.caveat, /không phải dự báo/);
  assert.match(stock.limit, /Không đủ cơ sở tự đặt hàng/);
});
