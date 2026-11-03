import type { AlertButton, AlertOptions, ModalProps } from 'react-native';

export type PopupProps = ModalProps & {
  onPresent?: () => void;
  onActiveChange?: (active: boolean) => void;
  feedback?: boolean;
};
export type PopupEntry = {
  id: string;
  parentId: string | null;
} & (
  | { kind: 'modal'; props: PopupProps }
  | {
      kind: 'alert';
      title: string;
      message?: string;
      buttons: AlertButton[];
      options?: AlertOptions;
    }
);

/** Independent popups are FIFO. A dialog's own feedback completes before it resumes. */
export function createPopupQueue() {
  let entries: PopupEntry[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  const getBranch = () => {
    const branch: PopupEntry[] = [];
    let next = entries.find(entry => entry.parentId === null);
    while (next) {
      branch.push(next);
      const parentId: string = next.id;
      next = entries.find(entry => entry.parentId === parentId);
    }
    return branch;
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => entries,
    getBranch,
    upsert(entry: PopupEntry) {
      const index = entries.findIndex(item => item.id === entry.id);
      if (index < 0) {
        entries = [...entries, entry];
      } else {
        entries = entries.map(item => (item.id === entry.id ? entry : item));
      }
      notify();
    },
    remove(id: string) {
      const removed = new Set([id]);
      // Children are registered after their parent, including nested dialogs.
      entries.forEach(entry => {
        if (entry.parentId && removed.has(entry.parentId))
          removed.add(entry.id);
      });
      const remaining = entries.filter(entry => !removed.has(entry.id));
      if (remaining.length === entries.length) return;
      entries = remaining;
      notify();
    },
    clear() {
      entries = [];
      notify();
    },
  };
}

export type PopupQueue = ReturnType<typeof createPopupQueue>;
