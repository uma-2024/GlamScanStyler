import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL_WITH_API } from '../config/api';
import CustomModal from '../components/CustomModal';
import { useModal } from '../hooks/useModal';
import { getLoginSession } from '../utils/authStorage';

interface AccountSettingsScreenProps {
  onBack?: () => void;
  onLogout?: () => void;
  onDeleteSuccess?: () => void;
  userId?: string;
}

const AccountSettingsScreen: React.FC<AccountSettingsScreenProps> = ({
  onBack,
  onLogout,
  onDeleteSuccess,
  userId,
}) => {
  const modal = useModal();

  const deleteAccountWithFallbackRoutes = async (stylistId: string): Promise<any> => {
    const session = await getLoginSession();
    const bearerToken = session?.loginId;
    const endpoints = [
      `${API_BASE_URL_WITH_API}/users/${stylistId}`,
      `${API_BASE_URL_WITH_API}/stylist/delete-account/${stylistId}`,
      `${API_BASE_URL_WITH_API}/partner/delete-account/${stylistId}`,
      `${API_BASE_URL_WITH_API}/stylist/${stylistId}/delete-account`,
      `${API_BASE_URL_WITH_API}/partner/${stylistId}/delete-account`,
      `${API_BASE_URL_WITH_API}/stylist/${stylistId}`,
      `${API_BASE_URL_WITH_API}/partner/${stylistId}`,
      `${API_BASE_URL_WITH_API}/stylist/delete-account`,
      `${API_BASE_URL_WITH_API}/partner/delete-account`,
    ];

    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
          },
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok && (result?.success !== false)) {
          return result;
        }

        lastError = new Error(result?.message || `Delete failed with status ${response.status}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Delete account request failed');
      }
    }

    throw lastError || new Error('Failed to delete account');
  };

  const handleDeleteAccount = () => {
    modal.showConfirm(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone. Note: Deleting your account will not automatically cancel active store subscriptions. Please manage or cancel active subscriptions in your device Settings.',
      async () => {
        if (!userId) return;
        try {
          const result = await deleteAccountWithFallbackRoutes(userId);

          modal.showModal(
            'Account Deleted',
            result?.message || 'Your account has been deleted successfully.',
            'success',
            [
              {
                text: 'OK',
                onPress: () => {
                  if (onDeleteSuccess) {
                    onDeleteSuccess();
                  } else if (onLogout) {
                    onLogout();
                  }
                },
                style: 'default',
                gradient: true,
              },
            ]
          );
        } catch (error) {
          console.error('Error deleting account:', error);
          modal.showAlert('Error', 'An unexpected error occurred while deleting your account.', 'error');
        }
      },
      undefined,
      'Delete',
      'Cancel',
      true
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      <CustomModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        buttons={modal.buttons}
        onClose={modal.hideModal}
      />
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Account Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <Text style={styles.sectionDescription}>
            Once you delete your account, there is no going back. Please be certain.
          </Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}>
            <Icon name="delete-outline" size={20} color="#FF3B30" />
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0C4',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 24,
    top: 10,
    zIndex: 1,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  content: {
    padding: 24,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 20,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
});

export default AccountSettingsScreen;
