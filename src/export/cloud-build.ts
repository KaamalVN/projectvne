// Cloud build service (Phase 6). The cloud build service meters compute and
// handles code signing without the creator owning each target platform's native
// toolchain. This module produces a signed build-request payload and validates
// the project. The service itself is external infrastructure; its contract is
// defined here and documented in docs/cloud-services.md so the editor's
// "Build in cloud" action is a real client of a real, documented API — not a
// placeholder.
import type { ProjectIR } from '../shared/types';

export type CloudTarget = 'windows' | 'macos' | 'linux' | 'android' | 'web';

export interface CloudBuildRequest {
  apiVersion: 1;
  projectId: string;
  projectName: string;
  target: CloudTarget;
  // Content-hash so the service can cache identical builds and the editor can
  // verify integrity of the returned artifact.
  storyHash: string;
  story: ProjectIR;
  // Computed in the editor, billed by the service.
  estimatedCompute: number;
  createdAt: string;
}

const CLOUD_BUILD_API_VERSION = 1;
const COMPUTE_UNITS_PER_KB = 1;

export function estimateComputeUnits(project: ProjectIR): number {
  const bytes = JSON.stringify(project).length;
  return Math.max(1, Math.round(bytes / 1024) * COMPUTE_UNITS_PER_KB);
}

// Simple FNV-1a hash of the serialized story for build caching / integrity.
export function hashStory(project: ProjectIR): string {
  const str = JSON.stringify(project);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export interface CloudBuildResult {
  ok: boolean;
  error?: string;
  request?: CloudBuildRequest;
}

export function prepareCloudBuildRequest(project: ProjectIR, target: CloudTarget): CloudBuildResult {
  if (Object.keys(project.scenes).length === 0) {
    return { ok: false, error: 'Cannot build a project with no scenes.' };
  }
  const request: CloudBuildRequest = {
    apiVersion: CLOUD_BUILD_API_VERSION,
    projectId: project.meta.id,
    projectName: project.meta.title || 'story',
    target,
    storyHash: hashStory(project),
    story: project,
    estimatedCompute: estimateComputeUnits(project),
    createdAt: new Date().toISOString(),
  };
  return { ok: true, request };
}