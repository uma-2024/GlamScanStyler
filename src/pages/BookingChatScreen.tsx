import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL_WITH_API } from '../config/api';

interface BookingChatScreenProps {
  bookingId: string;
  currentUserId: string;
  counterpartName: string;
  serviceName?: string;
  onBack: () => void;
}

interface ChatMessage {
  _id?: string;
  senderId: string;
  senderRole: 'user' | 'stylist';
  message: string;
  createdAt?: string;
}

const BookingChatScreen: React.FC<BookingChatScreenProps> = ({
  bookingId,
  currentUserId,
  counterpartName,
  serviceName,
  onBack,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [activeCounterpartName, setActiveCounterpartName] = useState(counterpartName || '');
  const [activeServiceName, setActiveServiceName] = useState(serviceName || '');
  const flatListRef = useRef<FlatList>(null);

  const fetchChat = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const response = await fetch(
        `${API_BASE_URL_WITH_API}/bookings/${bookingId}/chat?participantId=${encodeURIComponent(currentUserId)}`
      );
      const result = await response.json();

      if (response.ok && result?.success) {
        setMessages(Array.isArray(result.data?.messages) ? result.data.messages : []);
        setChatEnabled(Boolean(result.data?.chatEnabled));

        if (result.data?.participants) {
          if (!activeCounterpartName) {
            const isStylist = currentUserId === result.data.participants.stylistId;
            const name = isStylist ? result.data.participants.userName : result.data.participants.stylistName;
            if (name) setActiveCounterpartName(name);
          }
          if (!activeServiceName && result.data.participants.serviceName) {
            setActiveServiceName(result.data.participants.serviceName);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error fetching booking chat:', error);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [activeCounterpartName, activeServiceName, bookingId, currentUserId]);

  useEffect(() => {
    fetchChat(true);

    const interval = setInterval(() => {
      fetchChat(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchChat]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || !chatEnabled) {
      return;
    }

    setSending(true);

    if (/(?:\d[\s-]*){10}/.test(trimmed)) {
      setSending(false);
      Alert.alert(
        "Action Not Allowed",
        "Sharing phone numbers is not allowed to keep communication secure within Glammefy."
      );
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/bookings/${bookingId}/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          senderId: currentUserId,
          senderRole: 'stylist',
          message: trimmed,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Chat API Error ${response.status}:`, errorText);
        throw new Error(`Failed to send message (Status: ${response.status})`);
      }

      const result = await response.json();
      if (!result?.success) {
        console.error('❌ Chat Server Error:', result?.message);
        throw new Error(result?.message || 'Failed to send message');
      }

      setInput('');
      setMessages((prev) => [...prev, result.data]);
    } catch (error) {
      console.error('❌ Error sending booking chat message:', error);
    } finally {
      setSending(false);
    }
  }, [bookingId, chatEnabled, currentUserId, input, sending]);

  const headerSubtitle = useMemo(() => {
    if (serviceName) {
      return `${counterpartName} `;
    }

    return counterpartName;
  }, [counterpartName, serviceName]);

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.contentWrapper}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
              <Icon name="arrow-back" size={24} color="#2F241D" />
            </TouchableOpacity>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Chat with client</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {headerSubtitle}
              </Text>
            </View>
            <View style={{ width: 48 }}></View>
          </View>

          {!chatEnabled ? (
            <View style={styles.stateWrap}>
              <Icon name="forum" size={40} color="#C69772" />
              <Text style={styles.stateTitle}>Chat is not available yet</Text>
              <Text style={styles.stateText}>
                Messaging opens once the booking is confirmed.
              </Text>
            </View>
          ) : loading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator size="large" color="#FD8B36" />
              <Text style={styles.stateText}>Loading messages...</Text>
            </View>
          ) : (
            <View style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item, index) => item._id || `${item.senderId}-${index}`}
                contentContainerStyle={styles.messagesContent}
                scrollEnabled={true}
                nestedScrollEnabled={true}
                scrollsToTop={false}
                renderItem={({ item }) => {
                  const isMine = item.senderId === currentUserId;

                  return (
                    <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}>
                      <View style={[styles.messageBubble, isMine ? styles.messageBubbleMine : styles.messageBubbleOther]}>
                        <Text style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextOther]}>
                          {item.message}
                        </Text>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyWrap}>
                    <Icon name="chat-bubble-outline" size={36} color="#D0A07E" />
                    <Text style={styles.emptyTitle}>No messages yet</Text>
                    <Text style={styles.emptyText}>Start the conversation with your client.</Text>
                  </View>
                }
              />

              <View style={styles.inputBar}>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Type a message"
                  placeholderTextColor="#9D8C7E"
                  multiline
                />
                <TouchableOpacity
                  style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={!input.trim() || sending}
                  activeOpacity={0.85}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Icon name="send" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: compactTopPadding(30),
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1D9C6',
    backgroundColor: '#FFF8F2',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTextWrap: {
    flex: 1,
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2F241D',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#7A6758',
    marginTop: 2,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2F241D',
  },
  stateText: {
    fontSize: 14,
    color: '#7A6758',
    textAlign: 'center',
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexGrow: 1,
  },
  messageRow: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageBubbleMine: {
    backgroundColor: '#FD8B36',
    borderBottomRightRadius: 6,
  },
  messageBubbleOther: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1D9C6',
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextMine: {
    color: '#fff',
  },
  messageTextOther: {
    color: '#2F241D',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2F241D',
    marginTop: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#7A6758',
    textAlign: 'center',
    marginTop: 6,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1D9C6',
    backgroundColor: '#FFF8F2',
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EDD8C7',
    color: '#2F241D',
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FD8B36',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
});

export default BookingChatScreen;
