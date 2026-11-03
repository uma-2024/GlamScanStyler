import { useState, useCallback, useRef } from 'react';
import { ModalButton } from '../components/CustomModal';

export interface UseModalReturn {
  visible: boolean;
  title: string;
  message: string;
  type: 'error' | 'success' | 'info' | 'warning';
  buttons: ModalButton[];
  showModal: (
    title: string,
    message: string,
    type?: 'error' | 'success' | 'info' | 'warning',
    buttons?: ModalButton[],
  ) => void;
  hideModal: () => void;
  showAlert: (
    title: string,
    message: string,
    type?: 'error' | 'success' | 'info' | 'warning',
  ) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string,
    confirmGradient?: boolean,
  ) => void;
}

export const useModal = (): UseModalReturn => {
  type Request = {
    id: number;
    title: string;
    message: string;
    type: UseModalReturn['type'];
    buttons: ModalButton[];
  };
  const [requests, setRequests] = useState<Request[]>([]);
  const nextId = useRef(0);
  const current = requests[0];
  const currentId = useRef<number | undefined>(undefined);
  currentId.current = current?.id;

  const dismiss = useCallback((id?: number) => {
    setRequests(pending => pending.filter(request => request.id !== id));
  }, []);

  const hideModal = useCallback(() => {
    dismiss(currentId.current);
  }, [dismiss]);

  const showModal = useCallback(
    (
      title: string,
      message: string,
      type: UseModalReturn['type'] = 'info',
      buttons?: ModalButton[],
    ) => {
      const id = ++nextId.current;
      let handled = false;
      const modalButtons = (buttons || [{ text: 'OK', onPress: () => {} }]).map(
        button => ({
          ...button,
          onPress: () => {
            if (handled) return;
            handled = true;
            dismiss(id);
            button.onPress();
          },
        }),
      );
      setRequests(pending => [
        ...pending,
        { id, title, message, type, buttons: modalButtons },
      ]);
    },
    [dismiss],
  );

  const showAlert = useCallback(
    (
      alertTitle: string,
      alertMessage: string,
      alertType: 'error' | 'success' | 'info' | 'warning' = 'info',
    ) => {
      showModal(alertTitle, alertMessage, alertType);
    },
    [showModal],
  );

  const showConfirm = useCallback(
    (
      confirmTitle: string,
      confirmMessage: string,
      onConfirm: () => void,
      onCancel?: () => void,
      confirmText: string = 'Confirm',
      cancelText: string = 'Cancel',
      confirmGradient: boolean = false,
    ) => {
      showModal(confirmTitle, confirmMessage, 'warning', [
        {
          text: cancelText,
          onPress: () => {
            if (onCancel) {
              onCancel();
            }
          },
          style: 'cancel',
        },
        {
          text: confirmText,
          onPress: () => {
            onConfirm();
          },
          style: 'default',
          gradient: confirmGradient,
        },
      ]);
    },
    [showModal],
  );

  return {
    visible: !!current,
    title: current?.title ?? '',
    message: current?.message ?? '',
    type: current?.type ?? 'info',
    buttons: current?.buttons ?? [],
    showModal,
    hideModal,
    showAlert,
    showConfirm,
  };
};
