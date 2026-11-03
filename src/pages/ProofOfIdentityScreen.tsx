import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

type IDType = 'aadhar' | 'pan' | 'drivers' | 'passport';

interface ProofOfIdentityScreenProps {
  onBack?: () => void;
  onSelectIDType?: (idType: IDType) => void;
  onPrivacyPolicy?: () => void;
}

const idTypes = [
  { id: 'aadhar' as IDType, label: "Aadhar Card" },
  { id: 'pan' as IDType, label: "PAN Card" },
  { id: 'drivers' as IDType, label: "Driver's Licence" },
  { id: 'passport' as IDType, label: "Passport" },
];

const ProofOfIdentityScreen: React.FC<ProofOfIdentityScreenProps> = ({
  onBack,
  onSelectIDType,
  onPrivacyPolicy,
}) => {
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Illustration */}
        <View style={styles.illustrationContainer}>
          <View style={styles.idCardIllustration}>
            <View style={styles.idCardFace}>
              <View style={styles.faceOutline} />
            </View>
            <View style={styles.idCardLines}>
              <View style={styles.idCardLine} />
              <View style={styles.idCardLine} />
              <View style={styles.idCardLineShort} />
            </View>
            <View style={styles.idCardSignature}>
              <View style={styles.signatureLine} />
            </View>
          </View>
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Proof Of Identity</Text>
          <Text style={styles.subtitle}>
            We Need To See Your Name Clearly Printed On An Official Document.
          </Text>
        </View>

        {/* ID Types Section */}
        <View style={styles.idTypesSection}>
          <Text style={styles.idTypesHeading}>TYPES OF ID YOU CAN UPLOAD</Text>
          <View style={styles.idTypesList}>
            {idTypes.map((idType) => (
              <TouchableOpacity
                key={idType.id}
                style={styles.idTypeButton}
                onPress={() => onSelectIDType && onSelectIDType(idType.id)}
                activeOpacity={0.8}>
                <Text style={styles.idTypeText}>{idType.label}</Text>
                <Icon name="chevron-right" size={20} color="#FD8B36" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

       
       
      </ScrollView>
       {/* Footer */}
       <View style={styles.footer}>
          <Icon name="lock" size={16} color="#333" />
          <Text style={styles.footerText}>
            Processes your personal data in accordance with our{' '}
            <Text style={styles.privacyLink} onPress={onPrivacyPolicy}>
              Privacy Policy
            </Text>
          </Text>
        </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(20),
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  idCardIllustration: {
    width: 200,
    height: 140,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    transform: [{ rotate: '-5deg' }],
  },
  idCardFace: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#1976D2',
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceOutline: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#1976D2',
  },
  idCardLines: {
    marginBottom: 8,
  },
  idCardLine: {
    height: 2,
    backgroundColor: '#1976D2',
    marginBottom: 4,
    borderRadius: 1,
  },
  idCardLineShort: {
    height: 2,
    width: '60%',
    backgroundColor: '#1976D2',
    borderRadius: 1,
  },
  idCardSignature: {
    marginTop: 8,
  },
  signatureLine: {
    height: 3,
    width: '70%',
    backgroundColor: '#1976D2',
    borderRadius: 2,
  },
  titleSection: {
    marginBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  idTypesSection: {
    marginBottom: 40,
  },
  idTypesHeading: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  idTypesList: {
    gap: 12,
  },
  idTypeButton: {
    backgroundColor: '#FFF8F0',
    borderRadius: 52,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FFE5CC',
  },
  idTypeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: compactTopPadding(20),
    position: 'absolute',
    bottom: '5%',
    left: '10%',
    right: '10%',
  },
  footerText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    marginLeft: 8,
    lineHeight: 18,
  },
  privacyLink: {
    color: '#FD8B36',
    fontWeight: '500',
  },
});

export default ProofOfIdentityScreen;
