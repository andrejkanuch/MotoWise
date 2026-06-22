import { describe, expect, it } from 'vitest';
import { MAX_FILES_PER_DOCUMENT } from '../../constants/document-limits';
import { CreateDocumentSchema } from '../document';

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
});
