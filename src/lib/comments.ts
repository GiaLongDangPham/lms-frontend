import { apiFetch } from './apiClient';
import type { Page } from './assignments';
import type { UserSummary } from './grades';

export interface AssignmentComment {
  id: string;
  author: UserSummary;
  assignmentId: string | null;
  submissionId: string | null;
  body: string;
  createdAt: string;
}

function pageQuery(cursor?: string | null): string {
  const params = new URLSearchParams({ limit: '100' });
  if (cursor) params.set('cursor', cursor);
  return `?${params.toString()}`;
}

export function listAssignmentComments(
  assignmentId: string,
  cursor?: string | null,
): Promise<Page<AssignmentComment>> {
  return apiFetch(
    `/assignments/${encodeURIComponent(assignmentId)}/comments${pageQuery(cursor)}`,
  );
}

export function createAssignmentComment(
  assignmentId: string,
  body: string,
): Promise<AssignmentComment> {
  return apiFetch(`/assignments/${encodeURIComponent(assignmentId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function listAllAssignmentComments(assignmentId: string): Promise<AssignmentComment[]> {
  const comments: AssignmentComment[] = [];
  const visitedCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const page = await listAssignmentComments(assignmentId, cursor);
    comments.push(...page.items);
    cursor = page.page.nextCursor;
    if (cursor && visitedCursors.has(cursor)) {
      throw new Error('API trả về cursor phân trang bình luận bị lặp.');
    }
    if (cursor) visitedCursors.add(cursor);
  } while (cursor);

  return comments;
}
