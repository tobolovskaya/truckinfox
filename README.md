# 🚚 TruckinFox

TruckinFox is a comprehensive cargo transportation platform connecting customers with verified carriers across Norway. Built with React Native, Expo, and Firebase.

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
- 🔐 **Secure Authentication**: Firebase Auth with email/phone
- 🔔 **Push Notifications**: Real-time updates
- 📊 **Analytics**: Firebase Performance Monitoring
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

- **Firebase Authentication** - User management
- **Firestore** - Real-time database
- **Firebase Storage** - File uploads
- **Cloud Functions** - Serverless backend
- **Firebase Cloud Messaging** - Push notifications

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
- Firebase account
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

Edit `.env` with your Firebase and API credentials:

```env
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
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

# Web
npm run web
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
│   ├── firebase.ts
│   ├── i18n.ts
│   └── ...
├── hooks/                # Custom React hooks
├── utils/                # Utility functions
├── theme/                # Design system
├── constants/            # App constants
├── locales/              # Translation files
│   ├── en/
│   └── no/
├── functions/            # Firebase Cloud Functions
└── mocks/                # Test data

```

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

## 🔥 Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Add iOS and Android apps
4. Download configuration files

### 2. Deploy Firebase

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Cloud Functions
cd functions
npm run build
cd ..
firebase deploy --only functions
```

## 📚 Documentation

- [Push Notifications Setup](./PUSH_NOTIFICATIONS_SETUP.md)
- [Quick Deploy Guide](./QUICK_DEPLOY_SETUP.md)
- [UI/UX Improvements](./UIUX_PERFORMANCE_IMPROVEMENTS.md)
- [Vipps Integration](./VIPPS_INTEGRATION_REPORT.md)

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

- Firestore security rules implemented
- Storage security rules implemented
- Environment variables for sensitive data
- HTTPS-only Cloud Functions
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
- Firebase team for the comprehensive backend solution
- Vipps for payment integration
- Norwegian design inspiration for the warm orange palette

## 📞 Support

For support, email support@truckinfox.com or create an issue on GitHub.

---

Made with ❤️ in Norway 🇳🇴
