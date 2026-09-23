/**
 * Immutable updates by dotted path ('sections.3.data.items.1.label.he') — the editor's single way of
 * changing the document. Untouched branches keep their identity (structural sharing), so React and the
 * undo history stay cheap. Numeric segments index arrays.
 */

export type Path = string;

export const splitPath = (path: Path): string[] => (path ? path.split('.') : []);
export const joinPath = (...parts: (string | number)[]): Path => parts.filter((p) => p !== '').join('.');

type Container = Record<string, unknown> | unknown[];

const isContainer = (v: unknown): v is Container => typeof v === 'object' && v !== null;

export function getAt(root: unknown, path: Path): unknown {
  let node: unknown = root;
  for (const key of splitPath(path)) {
    if (!isContainer(node)) return undefined;
    node = Array.isArray(node) ? node[Number(key)] : node[key];
  }
  return node;
}

function shallowCopy(node: Container): Container {
  return Array.isArray(node) ? [...node] : { ...node };
}

/** Returns a copy of `root` with `update(current)` at `path` (the root itself when path is ''). */
export function updateAt<T>(root: T, path: Path, update: (current: unknown) => unknown): T {
  const keys = splitPath(path);
  const rec = (node: unknown, i: number): unknown => {
    if (i === keys.length) return update(node);
    if (!isContainer(node))
      throw new Error(`updateAt: no container at "${keys.slice(0, i).join('.')}" (${path})`);
    const key = keys[i]!;
    const child = Array.isArray(node) ? node[Number(key)] : node[key];
    const next = rec(child, i + 1);
    if (next === child) return node;
    const copy = shallowCopy(node);
    if (Array.isArray(copy)) copy[Number(key)] = next;
    else copy[key] = next;
    return copy;
  };
  return rec(root, 0) as T;
}

export const setAt = <T>(root: T, path: Path, value: unknown): T => updateAt(root, path, () => value);

/** Removes an array item or an object key. */
export function removeAt<T>(root: T, path: Path): T {
  const keys = splitPath(path);
  const last = keys.pop();
  if (last === undefined) throw new Error('removeAt: empty path');
  return updateAt(root, keys.join('.'), (parent) => {
    if (Array.isArray(parent)) return parent.filter((_, i) => i !== Number(last));
    if (!isContainer(parent)) return parent;
    const rest: Record<string, unknown> = { ...parent };
    delete rest[last];
    return rest;
  });
}

/** Inserts `value` into the array at `arrayPath` (index defaults to the end). */
export function insertAt<T>(root: T, arrayPath: Path, value: unknown, index?: number): T {
  return updateAt(root, arrayPath, (list) => {
    const arr = Array.isArray(list) ? [...list] : [];
    arr.splice(index ?? arr.length, 0, value);
    return arr;
  });
}

/** Moves an array item from one index to another. */
export function moveAt<T>(root: T, arrayPath: Path, from: number, to: number): T {
  if (from === to) return root;
  return updateAt(root, arrayPath, (list) => {
    if (!Array.isArray(list)) return list;
    const arr = [...list];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    return arr;
  });
}

/** A short id not in `taken`: 'faq' → 'faq-2', 'faq-3'… (sections, venues, timeline items…). */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  let n = 2;
  while (set.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
