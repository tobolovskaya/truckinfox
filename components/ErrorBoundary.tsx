import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../lib/sharedStyles';
import { logEvent } from '../lib/analytics';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    logEvent.appError(
      'ErrorBoundary',
      error.message || 'Unknown error',
      Boolean(error.stack || errorInfo.componentStack)
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="alert-circle-outline" size={80} color={colors.error} />
            </View>

            <Text style={styles.title}>Noe gikk galt</Text>

            <Text style={styles.message}>En uventet feil oppstod. Vennligst prøv igjen.</Text>

            {__DEV__ && this.state.error && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorDetailsTitle}>Feildetaljer (kun i utviklingsmodus):</Text>
                <Text style={styles.errorDetailsText}>{this.state.error.toString()}</Text>
                {this.state.error.stack && (
                  <Text style={styles.errorStack} numberOfLines={10}>
                    {this.state.error.stack}
                  </Text>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.button} onPress={this.handleReset}>
              <Ionicons name="refresh-outline" size={20} color={colors.white} />
              <Text style={styles.buttonText}>Prøv igjen</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  iconContainer: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  errorDetails: {
    width: '100%',
    backgroundColor: colors.surfaceVariant,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    maxHeight: 200,
  },
  errorDetailsTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  errorDetailsText: {
    fontSize: fontSize.xs,
    color: colors.text.primary,
    fontFamily: 'monospace',
    marginBottom: spacing.sm,
  },
  errorStack: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontFamily: 'monospace',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    minWidth: 200,
  },
  buttonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
});
