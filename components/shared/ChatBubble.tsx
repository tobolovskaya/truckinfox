import { StyleSheet, Text, View } from 'react-native';

type ChatBubbleProps = {
  message: string;
  isMine?: boolean;
};

export default function ChatBubble({ message, isMine }: ChatBubbleProps) {
  return (
    <View style={[styles.bubble, isMine ? styles.mine : styles.theirs]}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { padding: 12, borderRadius: 16, maxWidth: '80%' },
  mine: { backgroundColor: '#1f4cf0', alignSelf: 'flex-end' },
  theirs: { backgroundColor: '#eef2ff', alignSelf: 'flex-start' },
  text: { color: '#0f172a' },
});
