import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  BackHandler,
  Keyboard,
  Modal as NativeModal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { attachPopupQueue, dismissActivePopup } from './QueuedAlert';
import {
  createPopupQueue,
  PopupEntry,
  PopupProps,
  PopupQueue,
} from './popupQueue';

const QueueContext = createContext<PopupQueue | null>(null);
const OwnerContext = createContext<string | null>(null);

export function QueuedModal(props: PopupProps) {
  const queue = useContext(QueueContext);
  const parentId = useContext(OwnerContext);
  const id = useId();
  const requested = useRef(false);

  useLayoutEffect(() => {
    if (!queue) {
      if (props.visible === false) props.onActiveChange?.(false);
      return;
    }
    if (props.visible === false) {
      requested.current = false;
      queue.remove(id);
      return;
    }
    const existing = queue.getSnapshot().find(entry => entry.id === id);
    // A parent that closed cancels its feedback, even if the owning screen
    // renders again before clearing the feedback's local visibility flag.
    if (requested.current && !existing) return;
    const form = props.feedback
      ? [...queue.getBranch()]
          .reverse()
          .find(entry => entry.kind === 'modal' && !entry.props.feedback)
      : undefined;
    const owner = existing ? existing.parentId : parentId ?? form?.id ?? null;
    requested.current = true;
    queue.upsert({ id, parentId: owner, kind: 'modal', props });
  }, [id, parentId, props, queue]);

  useLayoutEffect(
    () => () => {
      requested.current = false;
      queue?.remove(id);
    },
    [id, queue],
  );

  // Standalone screens/previews retain the ordinary React Native behavior.
  if (queue) return null;
  const { onPresent, onActiveChange, ...nativeProps } = props;
  delete nativeProps.feedback;
  return (
    <NativeModal
      {...nativeProps}
      onShow={event => {
        onPresent?.();
        onActiveChange?.(true);
        nativeProps.onShow?.(event);
      }}
      onDismiss={() => {
        onActiveChange?.(false);
        nativeProps.onDismiss?.();
      }}
    />
  );
}

function PopupContent({
  entry,
  active,
  queue,
}: {
  entry: PopupEntry;
  active: boolean;
  queue: PopupQueue;
}) {
  const propsRef = useRef(entry.kind === 'modal' ? entry.props : null);
  propsRef.current = entry.kind === 'modal' ? entry.props : null;
  const presented = useRef(false);

  useEffect(() => {
    propsRef.current?.onActiveChange?.(active);
    if (active && !presented.current) {
      presented.current = true;
      Keyboard.dismiss();
      propsRef.current?.onPresent?.();
    }
  }, [active]);

  useEffect(
    () => () => {
      if (presented.current) propsRef.current?.onDismiss?.();
    },
    [],
  );

  return (
    <OwnerContext.Provider value={entry.id}>
      <View
        testID={`popup-${entry.id}`}
        style={[
          StyleSheet.absoluteFill,
          entry.kind === 'modal' && !entry.props.transparent && styles.opaque,
          !active && styles.hidden,
        ]}
        pointerEvents={active ? 'auto' : 'none'}
        accessibilityElementsHidden={!active}
        importantForAccessibility={active ? 'yes' : 'no-hide-descendants'}
      >
        {entry.kind === 'modal' ? (
          entry.props.children
        ) : (
          <SafeAreaView style={styles.alertBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                if (!entry.options?.cancelable) return;
                queue.remove(entry.id);
                entry.options.onDismiss?.();
              }}
              accessible={false}
            />
            <View style={styles.alertCard} accessibilityViewIsModal>
              <ScrollView bounces={false}>
                <Text style={styles.title} accessibilityRole="header">
                  {entry.title}
                </Text>
                {!!entry.message && (
                  <Text style={styles.message}>{entry.message}</Text>
                )}
              </ScrollView>
              {entry.buttons.map((button, index) => (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  style={styles.button}
                  onPress={() => {
                    // Ignore rapid duplicate taps before React commits removal.
                    if (!queue.getSnapshot().some(item => item.id === entry.id))
                      return;
                    queue.remove(entry.id);
                    button.onPress?.();
                  }}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      button.style === 'destructive' && styles.destructive,
                    ]}
                  >
                    {button.text ?? 'OK'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </SafeAreaView>
        )}
      </View>
    </OwnerContext.Provider>
  );
}

function PopupHost({
  queue,
  children,
}: React.PropsWithChildren<{ queue: PopupQueue }>) {
  useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  const branch = queue.getBranch();
  const showing = branch.length > 0;

  useEffect(() => {
    if (!showing) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      dismissActivePopup,
    );
    return () => subscription.remove();
  }, [showing]);

  return (
    <View style={styles.container}>
      <View
        style={styles.container}
        pointerEvents={showing ? 'none' : 'auto'}
        accessibilityElementsHidden={showing}
        importantForAccessibility={showing ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {showing && (
        <View style={styles.host} testID="popup-host" accessibilityViewIsModal>
          {branch.map((entry, index) => (
            <PopupContent
              key={entry.id}
              entry={entry}
              active={index === branch.length - 1}
              queue={queue}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** One React overlay avoids overlapping native modal presentations on iOS/Android. */
export function PopupProvider({ children }: React.PropsWithChildren) {
  const [queue] = useState(createPopupQueue);
  useLayoutEffect(() => {
    const detach = attachPopupQueue(queue);
    return () => {
      detach();
      queue.clear();
    };
  }, [queue]);

  return (
    <QueueContext.Provider value={queue}>
      <PopupHost queue={queue}>{children}</PopupHost>
    </QueueContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  host: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000 },
  hidden: { display: 'none' },
  opaque: { backgroundColor: '#fff' },
  alertBackdrop: {
    flex: 1,
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 20,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#222', marginBottom: 12 },
  message: { fontSize: 16, lineHeight: 24, color: '#555', marginBottom: 16 },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#FFF4E9',
  },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#B84C00' },
  destructive: { color: '#C62828' },
});
