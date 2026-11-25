import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from '../../config/env.config';

const ALLOWED_MIME_TYPES = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['video/mp4', '.mp4'],
  ['audio/mpeg', '.mp3'],
  ['audio/mp4', '.m4a'],
  ['audio/ogg', '.ogg'],
  ['audio/webm', '.webm'],
  ['application/pdf', '.pdf'],
]);

function matchesMagicBytes(mime: string, buf: Buffer): boolean {
  if (buf.length < 4) return false;
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (mime === 'image/webp') return buf.subarray(0, 4).toString('ascii') === 'RIFF';
  if (mime === 'application/pdf') return buf.subarray(0, 4).toString('ascii') === '%PDF';
  if (mime === 'video/mp4' || mime === 'audio/mp4') {
    return buf.length >= 8 && buf.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  if (mime === 'audio/ogg') return buf.subarray(0, 4).toString('ascii') === 'OggS';
  if (mime === 'audio/webm') return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
  if (mime === 'audio/mpeg') {
    return (
      (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) ||
      (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
    );
  }
  return false;
}

export async function saveValidatedUpload(file: {
  mimetype: string;
  size: number;
  buffer: Buffer;
}): Promise<{ url: string; mimeType: string; sizeBytes: number; fileName: string }> {
  const cfg = loadConfig();
  if (!file || !file.buffer) {
    throw new BadRequestException('No file uploaded');
  }
  if (file.size <= 0 || file.size > cfg.maxUploadBytes) {
    throw new BadRequestException(`File size must be between 1 byte and ${cfg.maxUploadBytes} bytes`);
  }
  const ext = ALLOWED_MIME_TYPES.get(file.mimetype);
  if (!ext) {
    throw new BadRequestException('Unsupported file MIME type');
  }
  if (!matchesMagicBytes(file.mimetype, file.buffer)) {
    throw new BadRequestException('File contents do not match declared MIME type');
  }

  const baseDir = path.resolve(cfg.uploadDir);
  await fs.mkdir(baseDir, { recursive: true });
  const fileName = `${uuidv4()}${ext}`;
  const resolvedPath = path.resolve(baseDir, fileName);

  if (!resolvedPath.startsWith(baseDir + path.sep)) {
    throw new BadRequestException('Invalid upload target path');
  }

  await fs.writeFile(resolvedPath, file.buffer, { mode: 0o600 });
  return {
    url: `/api/v1/messaging/files/${fileName}`,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    fileName,
  };
}

export function resolveSafeUploadPath(fileName: string): string {
  const baseDir = path.resolve(loadConfig().uploadDir);
  const safeName = path.basename(fileName);
  if (!/^[a-f0-9-]{36}\.[a-z0-9]+$/i.test(safeName)) {
    throw new BadRequestException('Malformed file identifier');
  }
  const resolved = path.resolve(baseDir, safeName);
  if (!resolved.startsWith(baseDir + path.sep)) {
    throw new BadRequestException('Path traversal rejected');
  }
  return resolved;
}
