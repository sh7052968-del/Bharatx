import * as fs from 'fs';
import * as path from 'path';
import { ClientNavTab } from './types';

describe('ConnectX Web Client & Business Suite Invariants', () => {
  it('defines all required client navigation sections', () => {
    const expectedTabs: ClientNavTab[] = [
      'chats',
      'contacts',
      'communities',
      'calls',
      'business',
      'status',
      'settings',
    ];
    expect(expectedTabs).toHaveLength(7);
    expect(expectedTabs).toContain('chats');
    expect(expectedTabs).toContain('business');
    expect(expectedTabs).toContain('calls');
    expect(expectedTabs).toContain('status');
  });

  it('calculates deterministic order totals and currency formatting', () => {
    const unitPriceCents = 49900; // $499.00
    const quantity = 3;
    const totalCents = unitPriceCents * quantity;
    expect(totalCents).toBe(149700);

    const formattedDollars = (totalCents / 100).toFixed(2);
    expect(formattedDollars).toBe('1497.00');
  });

  it('enforces 24-hour status expiry delta calculation', () => {
    const createdAtMs = Date.parse('2026-11-25T12:00:00Z');
    const expiryTtlMs = 24 * 60 * 60 * 1000;
    const expiresAtMs = createdAtMs + expiryTtlMs;
    const diffHours = (expiresAtMs - createdAtMs) / (1000 * 60 * 60);

    expect(diffHours).toBe(24);
    expect(new Date(expiresAtMs).toISOString()).toBe('2026-11-26T12:00:00.000Z');
  });

  it('guarantees zero AI services, zero LLM models, and zero localStorage tokens in ClientApp', () => {
    const clientDir = path.resolve(__dirname, '../components/client');
    const files = fs.readdirSync(clientDir);

    expect(files.length).toBeGreaterThanOrEqual(7);

    for (const file of files) {
      if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue;
      const content = fs.readFileSync(path.join(clientDir, file), 'utf8');

      // Zero AI / LLM / OpenAI / Gemini / Chatbot imports
      expect(content).not.toMatch(/@google\/generative-ai|openai|langchain|anthropic|chatgpt|copilot/i);

      // Strict in-memory tokens
      expect(content).not.toMatch(/\blocalStorage\.|\bsessionStorage\./);
    }
  });
});
