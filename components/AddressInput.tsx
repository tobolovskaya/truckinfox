import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Dimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  searchNorwegianPlaces,
  getPlaceDetails,
  formatNorwegianAddress,
} from '../utils/googlePlaces';
import { theme } from '../theme/theme';
import { getPlatformShadow } from '../lib/platformShadow';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../lib/sharedStyles';

interface AddressInputProps {
  placeholder: string;
  value: string;
  onAddressSelect: (_address: string, _coordinates?: { lat: number; lng: number }) => void;
  onChangeText?: (_text: string) => void;
  style?: StyleProp<ViewStyle>;
}

interface Suggestion {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AddressInput({
  placeholder,
  value,
  onAddressSelect,
  onChangeText,
  style,
}: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = (text: string) => {
    onChangeText?.(text);

    // Clear previous timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (text.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce search
    searchTimeout.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchNorwegianPlaces(text);
        setSuggestions(results);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Address search error:', error);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSuggestionSelect = async (suggestion: Suggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);

    // Format the address for Norwegian standards
    const formattedAddress = formatNorwegianAddress(suggestion.description);

    // If it's an offline city, use stored coordinates
    if (suggestion.geometry?.location) {
      onAddressSelect(formattedAddress, suggestion.geometry.location);
      return;
    }

    // Get detailed place information with coordinates
    try {
      const details = await getPlaceDetails(suggestion.place_id);
      if (details) {
        onAddressSelect(
          formatNorwegianAddress(details.formatted_address),
          details.geometry.location
        );
      } else {
        onAddressSelect(formattedAddress);
      }
    } catch (error) {
      console.error('Error getting place details:', error);
      onAddressSelect(formattedAddress);
    }
  };

  const renderSuggestion = ({ item }: { item: Suggestion }) => (
    <TouchableOpacity style={styles.suggestionItem} onPress={() => handleSuggestionSelect(item)}>
      <Ionicons name="location-outline" size={20} color={theme.iconColors.primary} />
      <View style={styles.suggestionText}>
        <Text style={styles.suggestionMainText}>
          {item.structured_formatting?.main_text || item.description}
        </Text>
        {item.structured_formatting?.secondary_text && (
          <Text style={styles.suggestionSecondaryText}>
            {item.structured_formatting.secondary_text}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <Ionicons name="location" size={20} color={theme.iconColors.gray.primary} />
        <TextInput
          style={styles.textInput}
          placeholder={placeholder}
          value={value}
          onChangeText={handleInputChange}
          placeholderTextColor="#9CA3AF"
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading && <Ionicons name="refresh" size={20} color={theme.iconColors.primary} />}
      </View>

      <Modal
        visible={showSuggestions && suggestions.length > 0}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuggestions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSuggestions(false)}
        >
          <View style={styles.suggestionsContainer}>
            <FlatList
              data={suggestions}
              renderItem={renderSuggestion}
              keyExtractor={item => item.place_id}
              style={[styles.suggestionsList, { maxHeight: SCREEN_HEIGHT * 0.4 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  textInput: {
    flex: 1,
    fontSize: fontSize.lg,
    color: colors.text.primary,
    marginLeft: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'flex-start',
    paddingTop: 100,
  },
  suggestionsContainer: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    ...getPlatformShadow({
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    }),
  },
  suggestionsList: {
    maxHeight: 300,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.light,
  },
  suggestionText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  suggestionMainText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  suggestionSecondaryText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
});
