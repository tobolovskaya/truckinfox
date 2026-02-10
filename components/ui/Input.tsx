import { StyleSheet, Text, TextInput, View } from 'react-native';

type InputProps = {
  label?: string;
  value?: string;
  placeholder?: string;
  onChangeText?: (value: string) => void;
};

export default function Input({ label, value, placeholder, onChangeText }: InputProps) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={styles.input}
        value={value}
        placeholder={placeholder}
        onChangeText={onChangeText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#d6dbe2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
