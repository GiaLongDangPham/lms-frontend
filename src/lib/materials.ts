import { apiFetch } from './apiClient';
import { pageQuery, type FileRecord, type Page } from './assignments';

export interface Material {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  files: FileRecord[];
  createdAt: string;
}

export function listMaterials(classId: string, cursor?: string | null): Promise<Page<Material>> {
  return apiFetch(`/classes/${encodeURIComponent(classId)}/materials${pageQuery(cursor)}`);
}

export async function listAllMaterials(classId: string): Promise<Material[]> {
  const materials: Material[] = [];
  let cursor: string | null = null;
  do {
    const page: Page<Material> = await listMaterials(classId, cursor);
    materials.push(...page.items);
    cursor = page.page.nextCursor;
  } while (cursor);
  return materials.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

const mimeTypeLabels: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'application/zip': 'ZIP',
};

export function fileTypeLabel(file: Pick<FileRecord, 'originalName' | 'mimeType'>): string {
  const extension = /\.([a-z0-9]+)$/i.exec(file.originalName)?.[1];
  if (extension) return extension.toUpperCase();
  return mimeTypeLabels[file.mimeType] ?? 'Tệp';
}
