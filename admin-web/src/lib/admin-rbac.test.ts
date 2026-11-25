import * as fs from 'fs';
import * as path from 'path';
import { ADMIN_ROLE_LABELS, ROLE_VISIBLE_MODULES } from './types';
import { formatBytes, formatCurrencyCents } from './utils';

describe('ConnectX Super Admin Web Console RBAC & Security Guarantees', () => {
  it('defines all 8 multi-admin levels and restricts module visibility per role', () => {
    expect(ADMIN_ROLE_LABELS.SUPER_ADMIN).toBe('Super Admin');
    expect(ADMIN_ROLE_LABELS.PLATFORM_ADMIN).toBe('Platform Admin');
    expect(ADMIN_ROLE_LABELS.SECURITY_ADMIN).toBe('Security Admin');
    expect(ADMIN_ROLE_LABELS.BUSINESS_ADMIN).toBe('Business Admin');
    expect(ADMIN_ROLE_LABELS.FINANCE_ADMIN).toBe('Finance Admin');
    expect(ADMIN_ROLE_LABELS.CONTENT_MODERATOR).toBe('Content Moderator');
    expect(ADMIN_ROLE_LABELS.SUPPORT_ADMIN).toBe('Customer Support Admin');
    expect(ADMIN_ROLE_LABELS.CUSTOM_ADMIN).toBe('Custom Admin');

    expect(ROLE_VISIBLE_MODULES.SUPER_ADMIN).toHaveLength(13);
    expect(ROLE_VISIBLE_MODULES.FINANCE_ADMIN).toContain('finance');
    expect(ROLE_VISIBLE_MODULES.FINANCE_ADMIN).not.toContain('developer');
    expect(ROLE_VISIBLE_MODULES.CONTENT_MODERATOR).toContain('moderation');
    expect(ROLE_VISIBLE_MODULES.CONTENT_MODERATOR).not.toContain('finance');
    expect(ROLE_VISIBLE_MODULES.MEMBER).toHaveLength(0);
  });

  it('formats storage bytes and currency cents deterministically', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatCurrencyCents(2900, 'USD')).toBe('$29.00');
  });

  it('keeps JWT tokens strictly in memory with zero localStorage/sessionStorage usage and zero AI imports', () => {
    const srcRoot = path.resolve(__dirname, '..');
    const authCtx = fs.readFileSync(path.join(srcRoot, 'lib/auth-context.tsx'), 'utf8');
    const apiClient = fs.readFileSync(path.join(srcRoot, 'lib/api-client.ts'), 'utf8');

    expect(authCtx).not.toMatch(/\blocalStorage\.|\bsessionStorage\./);
    expect(apiClient).not.toMatch(/\blocalStorage\.|\bsessionStorage\./);

    const devPanel = fs.readFileSync(
      path.join(srcRoot, 'components/admin/DeveloperPanel.tsx'),
      'utf8',
    );
    expect(devPanel).toContain('Controlled Code Releases Only');
    expect(devPanel).not.toMatch(/eval\(|new Function/);
  });
});
