import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function resolveProjectPath(projectPath: string): string {
  return path.resolve(process.cwd(), projectPath);
}

export function readProjectSource(projectPath: string): string {
  return readFileSync(resolveProjectPath(projectPath), 'utf8');
}

export function projectFileExists(projectPath: string): boolean {
  return existsSync(resolveProjectPath(projectPath));
}
