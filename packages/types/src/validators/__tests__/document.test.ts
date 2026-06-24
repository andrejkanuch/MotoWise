import { describe, expect, it } from 'vitest';
import { MAX_FILES_PER_DOCUMENT, MAX_IMAGE_BYTES } from '../../constants/document-limits';
import {
  AddDocumentCategorySchema,
  CreateDocumentSchema,
  UpdateDocumentCategorySchema,
  UpdateDocumentSchema,
} from '../document';

const validFile = {
  storagePath: 'user/bike/doc/insurance.pdf',
  fileSizeBytes: 1024,
  mimeType: 'application/pdf',
};

const baseInput = {
  documentId: '11111111-1111-1111-1111-111111111111',
  motorcycleId: '22222222-2222-2222-2222-222222222222',
  categoryId: '33333333-3333-3333-3333-333333333333',
  title: 'Policy 2026',
  files: [validFile],
};

describe('CreateDocumentSchema', () => {
  it('accepts a valid single-file document', () => {
    expect(CreateDocumentSchema.parse(baseInput).files).toHaveLength(1);
  });

  it('rejects a files array longer than the cap (R3)', () => {
    const tooMany = {
      ...baseInput,
      files: Array.from({ length: MAX_FILES_PER_DOCUMENT + 1 }, () => validFile),
    };
    expect(() => CreateDocumentSchema.parse(tooMany)).toThrow();
  });

  it('rejects an empty files array', () => {
    expect(() => CreateDocumentSchema.parse({ ...baseInput, files: [] })).toThrow();
  });

  it('rejects an unknown MIME type (R3)', () => {
    const badMime = {
      ...baseInput,
      files: [{ ...validFile, mimeType: 'text/html' }],
    };
    expect(() => CreateDocumentSchema.parse(badMime)).toThrow();
  });

  it('rejects a non-uuid documentId', () => {
    expect(() => CreateDocumentSchema.parse({ ...baseInput, documentId: 'nope' })).toThrow();
  });

  it('rejects a malformed expiry date', () => {
    expect(() => CreateDocumentSchema.parse({ ...baseInput, expiryDate: '06/22/2026' })).toThrow();
  });

  it('accepts an image above the per-image cap (per-MIME cap is service-enforced)', () => {
    // The Zod ceiling is the largest single-file cap (PDF, 20 MB); the per-type
    // image cap (5 MB) is enforced in DocumentsService.create via maxBytesForMime.
    // This documents that split: an over-image-cap JPEG passes Zod but the service
    // rejects it.
    const bigImage = {
      ...baseInput,
      files: [{ ...validFile, mimeType: 'image/jpeg', fileSizeBytes: MAX_IMAGE_BYTES + 1 }],
    };
    expect(() => CreateDocumentSchema.parse(bigImage)).not.toThrow();
  });
});

describe('UpdateDocumentSchema', () => {
  it('treats null expiryDate (clear) and omission (leave) as distinct', () => {
    expect(UpdateDocumentSchema.parse({ expiryDate: null }).expiryDate).toBeNull();
    expect('expiryDate' in UpdateDocumentSchema.parse({ title: 'x' })).toBe(false);
  });

  it('accepts a null note (clear) and a boolean isPinned', () => {
    expect(UpdateDocumentSchema.parse({ note: null }).note).toBeNull();
    expect(UpdateDocumentSchema.parse({ isPinned: true }).isPinned).toBe(true);
  });

  it('rejects an empty title and a non-uuid categoryId', () => {
    expect(() => UpdateDocumentSchema.parse({ title: '' })).toThrow();
    expect(() => UpdateDocumentSchema.parse({ categoryId: 'nope' })).toThrow();
  });
});

describe('document category schemas', () => {
  it('AddDocumentCategorySchema enforces a 1–60 char name', () => {
    expect(AddDocumentCategorySchema.parse({ name: 'Toll Tags' }).name).toBe('Toll Tags');
    expect(() => AddDocumentCategorySchema.parse({ name: '' })).toThrow();
    expect(() => AddDocumentCategorySchema.parse({ name: 'x'.repeat(61) })).toThrow();
  });

  it('UpdateDocumentCategorySchema accepts name and/or isHidden', () => {
    expect(UpdateDocumentCategorySchema.parse({ isHidden: true }).isHidden).toBe(true);
    expect(UpdateDocumentCategorySchema.parse({ name: 'Renamed' }).name).toBe('Renamed');
  });
});
