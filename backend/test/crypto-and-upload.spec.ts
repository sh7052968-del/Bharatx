import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { CryptoService } from '../src/common/crypto/crypto.service';
import { resolveSafeUploadPath, saveValidatedUpload } from '../src/common/upload/upload-security';

describe('CryptoService & Upload Security Unit Tests', () => {
  const cryptoService = new CryptoService();

  it('hashes and verifies passwords with Argon2id', async () => {
    const hash = await cryptoService.hashPassword('ConnectX#Enterprise2026');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await cryptoService.verifyPassword(hash, 'ConnectX#Enterprise2026')).toBe(true);
    expect(await cryptoService.verifyPassword(hash, 'WrongPassword')).toBe(false);
  });

  it('encrypts and decrypts MFA secrets using AES-256-GCM', () => {
    const secret = cryptoService.generateBase32Secret(20);
    const envelope = cryptoService.encryptSecret(secret);
    expect(envelope.split('.').length).toBe(3);
    expect(cryptoService.decryptSecret(envelope)).toBe(secret);
  });

  it('generates and verifies RFC-6238 TOTP MFA codes', () => {
    const secret = cryptoService.generateBase32Secret(20);
    const code = cryptoService.generateTotpCode(secret);
    expect(code).toMatch(/^\d{6}$/);
    expect(cryptoService.verifyTotp(secret, code)).toBe(true);
    expect(cryptoService.verifyTotp(secret, '000000')).toBe(false);
  });

  it('rejects mismatched magic bytes and path traversal attempts in uploads', async () => {
    await expect(
      saveValidatedUpload({
        mimetype: 'image/png',
        size: 10,
        buffer: Buffer.from('not-a-png-file'),
      }),
    ).rejects.toThrow(BadRequestException);

    expect(() => resolveSafeUploadPath('../../etc/passwd')).toThrow(BadRequestException);
    expect(() => resolveSafeUploadPath('bad-name.exe')).toThrow(BadRequestException);
  });

  it('stores valid PNG upload strictly inside upload directory', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'connectx-upload-'));
    process.env.UPLOAD_DIR = tmpDir;
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const saved = await saveValidatedUpload({
      mimetype: 'image/png',
      size: pngHeader.length,
      buffer: pngHeader,
    });
    expect(saved.url).toMatch(/^\/api\/v1\/messaging\/files\/[a-f0-9-]{36}\.png$/);
    const resolved = resolveSafeUploadPath(saved.fileName);
    expect(resolved.startsWith(path.resolve(tmpDir) + path.sep)).toBe(true);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
