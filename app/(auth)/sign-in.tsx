import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Modal } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../src/config/firebase';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Feil', 'Ugyldig e-post eller passord.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      if (
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        setShowRegisterModal(true);
      } else if (error.code === 'auth/configuration-not-found') {
        Alert.alert('Feil', 'Aktiver e-post/passord i Firebase Console.');
      } else {
        Alert.alert('Innloggingsfeil', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Logg inn</Text>
      <Text style={styles.subtitle}>Logg inn på konto</Text>

      <Text style={styles.label}>E-post</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="din@epost.no"
      />

      <Text style={styles.label}>Passord</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
      />

      <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Laster...' : 'Logg inn'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
        <Text style={styles.registerText}>
          Har du ikke konto? <Text style={styles.registerLink}>Registrer deg</Text>
        </Text>
      </TouchableOpacity>

      {/* Модальне вікно для реєстрації у фірмовому стилі */}
      <Modal
        visible={showRegisterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRegisterModal(false)}
      >
        <LinearGradient
          colors={theme.gradients ? theme.gradients.primary : ['#fff', '#eee']}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContentStyled}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <Ionicons
                name="person-add"
                size={40}
                color={theme.colors ? theme.colors.primary : '#8B4513'}
              />
            </View>
            <Text style={styles.modalTitleStyled}>Brukeren ble ikke funnet</Text>
            <Text style={styles.modalTextStyled}>Vil du registrere deg?</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 28 }}>
              <TouchableOpacity
                onPress={() => setShowRegisterModal(false)}
                style={[styles.modalButtonStyled, { backgroundColor: '#eee' }]}
              >
                <Text
                  style={[
                    styles.modalButtonTextStyled,
                    { color: theme.colors ? theme.colors.primary : '#8B4513' },
                  ]}
                >
                  Avbryt
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowRegisterModal(false);
                  router.push('/(auth)/sign-up');
                }}
                style={[
                  styles.modalButtonStyled,
                  {
                    backgroundColor: theme.colors ? theme.colors.primary : '#8B4513',
                    marginLeft: 14,
                  },
                ]}
              >
                <Text style={[styles.modalButtonTextStyled, { color: '#fff' }]}>Registrer deg</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 24 },
  label: { fontSize: 14, marginBottom: 8, color: '#333' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#8B4513',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  registerText: {
    textAlign: 'center',
    marginTop: 16,
    color: '#666',
  },
  registerLink: {
    color: '#8B4513',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContentStyled: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 7,
    alignItems: 'center',
  },
  modalTitleStyled: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#8B4513',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalTextStyled: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalButtonStyled: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  modalButtonTextStyled: {
    fontSize: 16,
    fontWeight: '600',
  },
});
