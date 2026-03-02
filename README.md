# 🚚 TruckinFox

TruckinFox is a comprehensive cargo transportation platform connecting customers with verified carriers across Norway. Built with React Native, Expo, and Supabase.

## ✨ Features

### For Customers

- 📦 **Create Cargo Requests**: Post detailed cargo transportation needs
- 💰 **Competitive Bidding**: Receive bids from multiple carriers
- 💳 **Secure Payments**: Vipps escrow payment integration
- 📍 **Real-time Tracking**: GPS tracking for active deliveries
- ⭐ **Rating System**: Review and rate carriers
- 💬 **Direct Messaging**: Chat with carriers in real-time

### For Carriers

- 🔍 **Browse Opportunities**: Find cargo requests matching your route
- 💼 **Place Bids**: Submit competitive offers
- ✅ **Verification**: Get verified through Brønnøysundregistrene
- 🗺️ **Route Optimization**: View pickup and delivery locations
- 📸 **Delivery Confirmation**: Signature capture for proof of delivery
- ⭐ **Build Reputation**: Earn ratings and reviews

### Platform Features

- 🌍 **Multi-language**: Norwegian (Bokmål) and English
- 📱 **iOS & Android**: Native mobile experience
- 🔐 **Secure Authentication**: Supabase Auth
- 🔔 **Push Notifications**: Real-time updates
- 📊 **Analytics**: App analytics and monitoring
- 🎨 **Modern UI**: iOS-native styled components
- 🟠 **Warm Design**: Orange monochrome color palette (#FF7043)

## 🛠 Tech Stack

### Frontend

- **React Native** - Mobile framework
- **Expo SDK 54+** - Development platform
- **Expo Router** - File-based routing
- **TypeScript** - Type safety
- **React Native Paper** - UI components
- **i18next** - Internationalization

### Backend

- **Supabase Auth** - User management
- **PostgreSQL (Supabase)** - Primary database
- **Supabase Storage** - File uploads
- **Supabase Realtime** - Live chat and tracking updates

### Payments & Services

- **Vipps** - Norwegian payment solution
- **Brønnøysundregistrene API** - Carrier verification
- **Google Maps** - Location services
- **Redis** - Optional caching layer

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator (Mac) or Android Emulator
- Supabase project (cloud or self-hosted)
- Vipps merchant account (for payments)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/tobolovskaya/truckinfox.git
cd truckinfox
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase and API credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
# ... other credentials
```

### 4. Start Development Server

```bash
npm start
```

### 5. Run on Device/Simulator

```bash
# iOS
npm run ios

# Android
npm run android
```

## 📱 Project Structure

```
truckinfox/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Main tab navigation
│   ├── auth/              # Authentication screens
│   ├── chat/              # Messaging screens
│   ├── request-details/   # Cargo request details
│   └── _layout.tsx        # Root layout
├── components/            # Reusable UI components
│   ├── home/             # Home screen components
│   ├── Avatar.tsx
│   ├── IOSButton.tsx
│   └── ...
├── contexts/             # React Context providers
│   ├── AuthContext.tsx
│   ├── I18nContext.tsx
│   └── ...
├── lib/                  # Core libraries
│   ├── supabase.ts
│   ├── i18n.ts
│   └── ...
├── hooks/                # Custom React hooks
├── utils/                # Utility functions (e.g. cargoFormConstants.ts, cargoImages.ts)
├── theme/                # Design system
├── constants/            # App constants
├── locales/              # Translation files
│   ├── en/
│   └── no/
└── mocks/                # Test data

```

### Cargo Form Constants

Shared form constants live in `utils/cargoFormConstants.ts`:

- `CARGO_TYPES` - cargo type options used in create/edit flows.
- `PRICE_TYPES` - pricing model options used in create/edit flows.
- `CARGO_TYPE_PRESETS` - type-based default suggestions and helper hints.

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run type-check

# Linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📦 Building

### Development Build

```bash
# iOS
eas build --platform ios --profile development

# Android
eas build --platform android --profile development
```

### Production Build

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

## 📚 Documentation

- [Push Notifications Setup](./PUSH_NOTIFICATIONS_SETUP.md)
- [Quick Deploy Guide](./QUICK_DEPLOY_SETUP.md)
- [UI/UX Improvements](./UIUX_PERFORMANCE_IMPROVEMENTS.md)
- [Vipps Integration](./VIPPS_INTEGRATION_REPORT.md)
- [Supabase Schema & RLS](./supabase/README.md)
- [Supabase Migration Plan](./SUPABASE_MIGRATION_PLAN.md)

## 🐘 Supabase (Self-host via Docker)

You can run Supabase on your own server and avoid cloud subscription costs.

### Local Docker stack

```bash
supabase start
supabase db reset
```

- API URL: `http://127.0.0.1:54321`
- DB URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

Use `supabase/schema.sql` as the source of truth for TruckinFox tables and RLS policies.

## 🎨 Design System

### Colors

- Primary: `#FF7043` (Warm Orange)
- Primary Light: `#FF9A76`
- Primary Dark: `#E64A19`
- Success: `#4CAF50`
- Error: `#F44336`

### Typography

- Headings: 32px, 24px, 20px
- Body: 16px
- Caption: 14px, 12px

### Spacing

- XS: 4px, SM: 8px, MD: 16px, LG: 24px, XL: 32px

## 🔐 Security

- Supabase RLS policies implemented
- Supabase Storage policies implemented
- Environment variables for sensitive data
- Input validation and sanitization

## 🌍 Internationalization

The app supports:

- 🇬🇧 English
- 🇳🇴 Norwegian (Bokmål)

To add a new language, create a translation file in `locales/[lang]/translation.json`.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary and confidential.

## 👥 Authors

- **tobolovskaya** - [GitHub](https://github.com/tobolovskaya)

## 🙏 Acknowledgments

- Expo team for the amazing development platform
- Supabase team for the open-source backend platform
- Vipps for payment integration
- Norwegian design inspiration for the warm orange palette

## 📞 Support

For support, email support@truckinfox.com or create an issue on GitHub.

---

Made with ❤️ in Norway 🇳🇴
