import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Svg from '../assets/google.svg';
import LinearGradient from '../components/AppLinearGradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const topOrbSize = Math.min(Math.max(screenWidth * 0.56, 210), 280);
const bottomOrbSize = Math.min(Math.max(screenWidth * 0.68, 250), 340);
const brandCardHeight = Math.min(Math.max(screenHeight * 0.48, 300), 390);

interface LoginSignupScreenProps {
  onContinueWithEmail?: () => void;
  onContinueWithGoogle?: () => void;
  onContinueWithApple?: () => void;
  onLogin?: () => void;
  onSkip?: () => void;
}

const LoginSignupScreen: React.FC<LoginSignupScreenProps> = ({
  onContinueWithEmail,
  onContinueWithGoogle,
  onContinueWithApple,
  onSkip,
}) => {
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.background}>
        <LinearGradient
          colors={['#FD8B36', '#F7BB2C']}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={styles.topOrb}
        />
        <LinearGradient
          colors={['#FD8B36', '#F7BB2C']}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 0 }}
          style={styles.bottomOrb}
        />

        <View style={styles.content}>
          <View style={styles.brandCard}>
          
            <View style={styles.logoBadge}>
              <Image
                source={require('../assets/logo.png')}
                style={styles.logoIllustration}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.logoText}>GlamMefy</Text>
            <Text style={styles.logoSubText}>PARTNER</Text>
          </View>

          <View style={styles.actionPanel}>
            <View style={styles.panelHandle} />
            <Text style={styles.welcomeTitle}>Welcome</Text>
            <Text style={styles.welcomeText}>
              Sign in to manage services, slots and bookings.
            </Text>

            <TouchableOpacity
              style={styles.emailButtonWrapper}
              onPress={onContinueWithEmail}
              activeOpacity={0.86}>
              <LinearGradient
                colors={['#FD8B36', '#F7BB2C']}
              locations={[0, 1]}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 0.5, y: 0 }}
                style={styles.emailButtonGradient}>
                <Text style={styles.emailButtonText}>Continue With Phone</Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.socialPrompt}>Or continue with</Text>

            <View style={styles.socialButtonRow}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={onContinueWithGoogle}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google">
                <LinearGradient
                  colors={['#FFFFFF', '#FFF3E8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.socialButtonGradient}>
                  <Svg width="26" height="26" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.socialButton}
                onPress={onContinueWithApple}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Continue with Apple">
                <LinearGradient
                  colors={['#FFFFFF', '#FFF3E8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.socialButtonGradient}>
                  <Icon name="apple" size={28} color="#000" />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {onSkip && (
              <TouchableOpacity
                style={styles.skipButtonContainer}
                onPress={onSkip}
                activeOpacity={0.7}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  background: {
    flex: 1,
  },
  topOrb: {
    position: 'absolute',
    top: -topOrbSize * 0.36,
    right: -topOrbSize * 0.25,
    width: topOrbSize,
    height: topOrbSize,
    borderRadius: topOrbSize / 2,
  },
  bottomOrb: {
    position: 'absolute',
    left: -bottomOrbSize * 0.38,
    bottom: -bottomOrbSize * 0.22,
    width: bottomOrbSize,
    height: bottomOrbSize,
    borderRadius: bottomOrbSize / 2,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
  },
  brandCard: {
    width: '100%',
    height: brandCardHeight,
    borderRadius: 10,

    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',

  },

 
  logoBadge: {
    width: 92,
    height: 92,
    borderRadius: 24,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoIllustration: {
    width: 68,
    height: 68,
  },
  logoText: {
    fontSize: 38,
    fontWeight: '800',
    color: '#111',
  },
  logoSubText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#6F3F20',
    letterSpacing: 5,
  },
  actionPanel: {
    width: '100%',
    marginTop: -28,
    borderRadius: 30,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 9,
  },
  panelHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#FFD0AD',
    marginBottom: 18,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#15110A',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6F3F20',
    marginBottom: 22,
    textAlign: 'center',
    maxWidth: 280,
  },
  emailButtonWrapper: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 999,
   
    marginBottom: 18,
    overflow: 'hidden',
 },
  emailButtonGradient: {
    width: '100%',
    paddingVertical: 15,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    overflow: 'hidden',
  },
  emailButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  socialPrompt: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A5A3C',
    textAlign: 'center',
    marginBottom: 14,
  },
  socialButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  socialButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    shadowColor: '#000',
    shadowOpacity: 0.11,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    overflow: 'hidden',
  },
  socialButtonGradient: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFD0AD',
    borderRadius: 27,
    overflow: 'hidden',
  },
  skipButtonContainer: {
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  skipButtonText: {
    color: '#FD8B36',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default LoginSignupScreen;
