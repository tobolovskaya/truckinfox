import React, { useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, spacing, borderRadius } from '../theme';
import { IOSButton } from './IOSButton';

interface SignaturePadProps {
  onSave: (signature: string) => void;
  onCancel?: () => void;
}

/**
 * SignaturePad component for delivery confirmation
 * Note: This is a simplified version. In production, use a library like react-native-signature-canvas
 */
export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onCancel }) => {
  const handleSave = () => {
    // In a real implementation, this would capture the signature as a base64 image
    // For now, we'll use a placeholder
    const signatureData = 'data:image/png;base64,placeholder';
    onSave(signatureData);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Here</Text>
      <View style={styles.signatureArea}>
        <Text style={styles.placeholder}>Signature area (swipe to sign)</Text>
      </View>
      <View style={styles.buttonContainer}>
        <IOSButton
          title="Clear"
          onPress={() => Alert.alert('Clear', 'Signature cleared')}
          variant="outlined"
          style={styles.button}
        />
        <IOSButton title="Cancel" onPress={onCancel} variant="text" style={styles.button} />
        <IOSButton title="Save" onPress={handleSave} variant="primary" style={styles.button} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  signatureArea: {
    height: 200,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  placeholder: {
    color: colors.textDisabled,
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
});

export default SignaturePad;
