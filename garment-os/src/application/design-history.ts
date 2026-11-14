/** Each editor owns its history. Derived geometry and unrelated stores are never snapshotted. */
export function createHistory<T>(initial: T, limit = 40) {
  let entries = [structuredClone(initial)], position = 0;
  return {
    get flags() { return { canUndo: position > 0, canRedo: position < entries.length - 1 }; },
    push(value: T) {
      entries = entries.slice(0, position + 1);
      entries.push(structuredClone(value));
      if (entries.length > limit) entries.shift();
      position = entries.length - 1;
    },
    reset(value: T) { entries = [structuredClone(value)]; position = 0; },
    undo(): T | null { return position > 0 ? structuredClone(entries[--position]) : null; },
    redo(): T | null { return position < entries.length - 1 ? structuredClone(entries[++position]) : null; },
  };
}
