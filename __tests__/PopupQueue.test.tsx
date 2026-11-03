import React from 'react';
import {
  Modal as NativeModal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { PopupProvider, QueuedModal } from '../src/popup/PopupProvider';
import { dismissActivePopup, QueuedAlert } from '../src/popup/QueuedAlert';
import { useModal, UseModalReturn } from '../src/hooks/useModal';
import RatingModal from '../src/components/RatingModal';

jest.mock('../src/config/api', () => ({
  API_BASE_URL_WITH_API: 'https://example.test/api',
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));

describe('shared popup queue', () => {
  let screen: renderer.ReactTestRenderer;

  const render = (children: React.ReactNode) => {
    act(() => {
      screen = renderer.create(<PopupProvider>{children}</PopupProvider>);
    });
  };
  const update = (children: React.ReactNode) => {
    act(() => {
      screen.update(<PopupProvider>{children}</PopupProvider>);
    });
  };
  const visibleTexts = () =>
    screen.root
      .findAllByType(Text)
      .filter(node => {
        let parent = node.parent;
        while (parent) {
          if (
            parent.props.accessibilityElementsHidden ||
            StyleSheet.flatten(parent.props.style)?.display === 'none'
          )
            return false;
          parent = parent.parent;
        }
        return true;
      })
      .map(node => node.props.children);
  const press = (title: string) => {
    const button = screen.root
      .findAll(node => typeof node.props.onPress === 'function')
      .find(node =>
        node.findAllByType(Text).some(text => text.props.children === title),
      );
    expect(button).toBeDefined();
    act(() => {
      button!.props.onPress();
    });
  };

  afterEach(() => {
    act(() => {
      screen?.unmount();
    });
    jest.restoreAllMocks();
  });

  it('shows simultaneous requests in order and removes the touch-blocking layer at the end', () => {
    const firstPresented = jest.fn();
    const secondPresented = jest.fn();
    const popups = (first: boolean, second: boolean) => (
      <>
        <Text>Screen content</Text>
        <QueuedModal visible={first} onPresent={firstPresented}>
          <Text>Welcome</Text>
        </QueuedModal>
        <QueuedModal visible={second} onPresent={secondPresented}>
          <Text>Subscription</Text>
        </QueuedModal>
      </>
    );
    render(popups(true, true));
    expect(visibleTexts()).toEqual(['Welcome']);
    expect(firstPresented).toHaveBeenCalledTimes(1);
    expect(secondPresented).not.toHaveBeenCalled();
    expect(screen.root.findAllByType(NativeModal)).toHaveLength(0);
    update(popups(false, true));
    expect(visibleTexts()).toEqual(['Subscription']);
    expect(secondPresented).toHaveBeenCalledTimes(1);
    update(popups(false, false));
    expect(screen.root.findAllByProps({ testID: 'popup-host' })).toHaveLength(
      0,
    );
    expect(visibleTexts()).toEqual(['Screen content']);
  });

  it('keeps FIFO order when queued data changes and skips cancelled requests', () => {
    const popups = (first: boolean, second: boolean, text: string) => (
      <>
        <QueuedModal visible={first}>
          <Text>First</Text>
        </QueuedModal>
        <QueuedModal visible={second}>
          <Text>Cancelled</Text>
        </QueuedModal>
        <QueuedModal visible>
          <Text>{text}</Text>
        </QueuedModal>
      </>
    );
    render(popups(true, true, 'Old booking'));
    update(popups(true, false, 'Updated booking'));
    expect(visibleTexts()).toEqual(['First']);
    update(popups(false, false, 'Updated booking'));
    expect(visibleTexts()).toEqual(['Updated booking']);
  });

  it('removes both active and waiting screen popups on navigation', () => {
    render(
      <>
        <QueuedModal visible>
          <Text>Screen A dialog</Text>
        </QueuedModal>
        <QueuedModal visible>
          <Text>Screen A queued dialog</Text>
        </QueuedModal>
      </>,
    );
    update(<Text>Screen B</Text>);
    expect(visibleTexts()).toEqual(['Screen B']);
    expect(screen.root.findAllByProps({ testID: 'popup-host' })).toHaveLength(
      0,
    );
  });

  it('presents nested success feedback without waiting for its parent to close', () => {
    const popups = (success: boolean) => (
      <QueuedModal visible>
        <Text>Rating form</Text>
        <QueuedModal visible={success}>
          <Text>Rating submitted</Text>
        </QueuedModal>
      </QueuedModal>
    );
    render(popups(false));
    expect(visibleTexts()).toEqual(['Rating form']);
    update(popups(true));
    expect(visibleTexts()).toEqual(['Rating submitted']);
    update(popups(false));
    expect(visibleTexts()).toEqual(['Rating form']);
    update(null);
    expect(screen.root.findAllByProps({ testID: 'popup-host' })).toHaveLength(
      0,
    );
  });

  it('queues validation alerts inside a form and preserves its mounted state', () => {
    const mount = jest.fn();
    const unmount = jest.fn();
    function Form() {
      React.useEffect(() => {
        mount();
        return unmount;
      }, []);
      return <Text>Form input</Text>;
    }
    render(
      <QueuedModal visible>
        <Form />
      </QueuedModal>,
    );
    act(() => {
      QueuedAlert.alert('Validation one');
      QueuedAlert.alert('Validation two');
    });
    expect(visibleTexts()).toEqual(['Validation one', 'OK']);
    press('OK');
    expect(visibleTexts()).toEqual(['Validation two', 'OK']);
    press('OK');
    expect(visibleTexts()).toEqual(['Form input']);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(unmount).not.toHaveBeenCalled();
  });

  it('shows sibling custom feedback within its form and cancels it when that form closes', () => {
    const popups = (form: boolean, feedback: boolean, message: string) => (
      <>
        <QueuedModal visible={form}>
          <Text>Service preferences</Text>
        </QueuedModal>
        <QueuedModal feedback visible={feedback}>
          <Text>{message}</Text>
        </QueuedModal>
      </>
    );
    render(popups(true, false, ''));
    update(popups(true, true, 'Enter an amount'));
    expect(visibleTexts()).toEqual(['Enter an amount']);
    update(popups(false, true, 'Enter an amount'));
    update(popups(false, true, 'Old feedback must stay cancelled'));
    expect(screen.root.findAllByProps({ testID: 'popup-host' })).toHaveLength(
      0,
    );
    update(popups(false, false, ''));
    update(popups(false, true, 'New message'));
    expect(visibleTexts()).toEqual(['New message']);
  });

  it('runs alert callbacks once and queues follow-up alerts without leaving an overlay', () => {
    render(<Text>Home</Text>);
    const confirm = jest.fn(() => QueuedAlert.alert('Done'));
    act(() => {
      QueuedAlert.alert('Confirm', '', [
        { text: 'Confirm action', onPress: confirm },
      ]);
    });
    const button = screen.root
      .findAll(node => typeof node.props.onPress === 'function')
      .find(node =>
        node
          .findAllByType(Text)
          .some(text => text.props.children === 'Confirm action'),
      )!;
    act(() => {
      button.props.onPress();
      button.props.onPress();
    });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(visibleTexts()).toEqual(['Done', 'OK']);
    press('OK');
    expect(visibleTexts()).toEqual(['Home']);
  });

  it('consumes Back while a popup is active and honors alert cancellation', () => {
    const onClose = jest.fn();
    render(
      <QueuedModal visible onRequestClose={onClose}>
        <View />
      </QueuedModal>,
    );
    act(() => {
      expect(dismissActivePopup()).toBe(true);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    const onDismiss = jest.fn();
    act(() => {
      QueuedAlert.alert('Cancelable', '', undefined, {
        cancelable: true,
        onDismiss,
      });
    });
    act(() => {
      expect(dismissActivePopup()).toBe(true);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    act(() => {
      QueuedAlert.alert('Required');
    });
    act(() => {
      expect(dismissActivePopup()).toBe(true);
    });
    expect(visibleTexts()).toEqual(['Required', 'OK']);
    update(null);
    expect(dismissActivePopup()).toBe(false);
  });

  it('completes the rating flow with only one navigation callback', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);
    const onClose = jest.fn();
    const onRatingSubmitted = jest.fn();
    render(
      <RatingModal
        visible
        bookingId="booking"
        userId="client"
        stylistId="stylist"
        userName="Client"
        onClose={onClose}
        onRatingSubmitted={onRatingSubmitted}
      />,
    );
    const star = screen.root
      .findAllByType(TouchableOpacity)
      .find(node => node.findAllByProps({ name: 'star-border' }).length > 0)!;
    act(() => {
      star.props.onPress();
    });
    const submit = screen.root
      .findAllByType(TouchableOpacity)
      .find(node =>
        node
          .findAllByType(Text)
          .some(text => text.props.children === 'Submit Rating'),
      )!;
    await act(async () => {
      await submit.props.onPress();
    });
    expect(visibleTexts()).toContain('Rating Submitted');
    press('Done');
    expect(onRatingSubmitted).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not overwrite repeated useModal requests or lose callback-created messages', () => {
    let modal: UseModalReturn;
    function Screen() {
      modal = useModal();
      return (
        <QueuedModal visible={modal.visible}>
          <Text>{modal.title}</Text>
          {modal.buttons.map(button => (
            <Pressable key={button.text} onPress={button.onPress}>
              <Text>{button.text}</Text>
            </Pressable>
          ))}
        </QueuedModal>
      );
    }
    render(<Screen />);
    act(() => {
      modal.showAlert('First', '');
      modal.showAlert('Second', '');
      modal.showConfirm('Third', '', () => modal.showAlert('Fourth', ''));
    });
    expect(visibleTexts()).toEqual(['First', 'OK']);
    press('OK');
    expect(visibleTexts()).toEqual(['Second', 'OK']);
    press('OK');
    expect(visibleTexts()).toEqual(['Third', 'Cancel', 'Confirm']);
    press('Confirm');
    expect(visibleTexts()).toEqual(['Fourth', 'OK']);
    press('OK');
    expect(screen.root.findAllByProps({ testID: 'popup-host' })).toHaveLength(
      0,
    );
  });
});
