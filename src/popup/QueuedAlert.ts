import { Alert as NativeAlert, NativeSyntheticEvent } from 'react-native';
import type { PopupQueue } from './popupQueue';

let activeQueue: PopupQueue | null = null;
let nextId = 0;

export function attachPopupQueue(queue: PopupQueue) {
  activeQueue = queue;
  return () => {
    if (activeQueue === queue) activeQueue = null;
  };
}

export function dismissActivePopup(): boolean {
  const branch = activeQueue?.getBranch() ?? [];
  const active = branch[branch.length - 1];
  if (!active || !activeQueue) return false;
  if (active.kind === 'modal') {
    active.props.onRequestClose?.({
      nativeEvent: {},
    } as NativeSyntheticEvent<any>);
  } else if (active.options?.cancelable) {
    activeQueue.remove(active.id);
    active.options.onDismiss?.();
  }
  // A non-cancelable popup consumes Back without navigating underneath it.
  return true;
}

export const QueuedAlert: Pick<typeof NativeAlert, 'alert'> = {
  alert(title, message, buttons, options) {
    if (!activeQueue) {
      NativeAlert.alert(title, message, buttons, options);
      return;
    }
    // Validation and confirmations from an open form must not wait for that
    // form to close. They share its slot, preserving the form's input state.
    const branch = activeQueue.getBranch();
    const parent = [...branch].reverse().find(entry => entry.kind === 'modal');
    activeQueue.upsert({
      id: `alert-${++nextId}`,
      parentId: parent?.id ?? null,
      kind: 'alert',
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: 'OK' }],
      options,
    });
  },
};
