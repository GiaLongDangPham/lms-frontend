import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMaterial,
  fileTypeLabel,
  listAllMaterials,
  summarizeMaterialFiles,
  updateMaterial,
  type Material,
} from './materials';
import type { FileRecord } from './assignments';

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

describe('material file summary', () => {
  const file = (originalName: string, sizeBytes: number): FileRecord => ({
    id: originalName,
    originalName,
    mimeType: '',
    sizeBytes,
    createdAt: '2026-10-13T09:00:00Z',
  });

  it('shows the type and size of a single file', () => {
    expect(summarizeMaterialFiles([file('chuong-1.pdf', 2_400_000)])).toBe('PDF · 2,3 MB');
  });

  it('shows the file count and total size of several files', () => {
    expect(summarizeMaterialFiles([file('a.pdf', 1024 * 1024), file('b.pptx', 2 * 1024 * 1024)])).toBe('2 tệp · 3 MB');
  });

  it('shows a dash for a material without files', () => {
    expect(summarizeMaterialFiles([])).toBe('—');
  });
});

describe('material create and edit requests', () => {
  function stubSavedMaterial() {
    vi.stubGlobal('localStorage', { getItem: () => null });
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      () => Promise.resolve(new Response(JSON.stringify(material('saved', '2026-10-13T09:00:00Z')))),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  const input = { title: 'Chương 1', description: null, fileIds: ['file-1', 'file-2'] };

  it('posts a new material to its class', async () => {
    const fetchMock = stubSavedMaterial();

    await createMaterial('class-1', input);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toMatch(/\/classes\/class-1\/materials$/);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });

  it('patches an existing material with the complete file list', async () => {
    const fetchMock = stubSavedMaterial();

    await updateMaterial('material-1', input);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toMatch(/\/materials\/material-1$/);
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });
});
