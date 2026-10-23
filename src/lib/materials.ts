import { apiFetch } from './apiClient';
import { formatFileSize, pageQuery, type FileRecord, type Page } from './assignments';

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

export interface MaterialInput {
  title: string;
  description: string | null;
  fileIds: string[];
}

export function getMaterial(materialId: string): Promise<Material> {
  return apiFetch(`/materials/${encodeURIComponent(materialId)}`);
}

export function createMaterial(classId: string, material: MaterialInput): Promise<Material> {
  return apiFetch(`/classes/${encodeURIComponent(classId)}/materials`, {
    method: 'POST',
    body: JSON.stringify(material),
  });
}

export function updateMaterial(materialId: string, material: MaterialInput): Promise<Material> {
  return apiFetch(`/materials/${encodeURIComponent(materialId)}`, {
    method: 'PATCH',
    body: JSON.stringify(material),
  });
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

export function summarizeMaterialFiles(files: FileRecord[]): string {
  const [onlyFile] = files;
  if (!onlyFile) return '—';
  if (files.length === 1) return `${fileTypeLabel(onlyFile)} · ${formatFileSize(onlyFile.sizeBytes)}`;
  const totalBytes = files.reduce((total, file) => total + file.sizeBytes, 0);
  return `${files.length} tệp · ${formatFileSize(totalBytes)}`;
}
