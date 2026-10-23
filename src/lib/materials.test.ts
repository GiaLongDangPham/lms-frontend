import { afterEach, describe, expect, it, vi } from 'vitest';
import { fileTypeLabel, listAllMaterials, type Material } from './materials';

afterEach(() => vi.unstubAllGlobals());

function material(id: string, createdAt: string): Material {
  return { id, classId: 'class-1', title: id, description: null, files: [], createdAt };
}

describe('file type label', () => {
  it('uses the upper-case file extension', () => {
    expect(fileTypeLabel({ originalName: 'chuong-1.pdf', mimeType: 'application/pdf' })).toBe('PDF');
    expect(fileTypeLabel({ originalName: 'Mo hinh ER.pptx', mimeType: 'application/octet-stream' })).toBe('PPTX');
    expect(fileTypeLabel({ originalName: 'bai-doc.docx', mimeType: '' })).toBe('DOCX');
  });

  it('falls back to the MIME type when the name has no extension', () => {
    expect(fileTypeLabel({ originalName: 'slides', mimeType: 'application/pdf' })).toBe('PDF');
  });

  it('shows a generic label when neither name nor MIME type is recognised', () => {
    expect(fileTypeLabel({ originalName: 'README', mimeType: 'text/plain' })).toBe('Tệp');
  });
});

describe('class materials', () => {
  it('loads every page and lists the oldest material first', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    const fetchMock = vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(
      url.includes('cursor=next')
        ? { items: [material('chuong-1', '2026-10-13T09:00:00Z')], page: { nextCursor: null } }
        : {
            items: [material('bai-doc', '2026-10-15T09:00:00Z'), material('chuong-2', '2026-10-14T09:00:00Z')],
            page: { nextCursor: 'next' },
          },
    ))));
    vi.stubGlobal('fetch', fetchMock);

    const materials = await listAllMaterials('class-1');

    expect(materials.map((item) => item.id)).toEqual(['chuong-1', 'chuong-2', 'bai-doc']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
