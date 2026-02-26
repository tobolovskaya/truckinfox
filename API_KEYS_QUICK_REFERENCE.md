# 🔐 API Keys Protection: Quick Reference Card

## ⚡ 30-Second Summary

| Item                  | Status       | Risk   | Action                                |
| --------------------- | ------------ | ------ | ------------------------------------- |
| **Development**       | ✅ Secure    | Low    | Keep using .env                       |
| **Google Places Key** | ⚠️ Exposed   | Medium | Migrate to Cloud Function in 3-6mo    |
| **Offline Fallback**  | ✅ Working   | None   | Already protecting availability       |
| **Production**        | 🔴 Not ready | High   | Follow deployment guide before launch |

---

## 🚀 Deployment Readiness

```
Development Build:   ✅ Ready now
Staging Build:       ⏳ Ready in 1 month
Production Build:    🔴 Ready in 3-6 months (after proxy migration)
```

---

## 📋 Setup Checklist (5 minutes)

- [ ] Copy `.env.example` to `.env`
- [ ] Add your Google Places API key to `.env`
- [ ] Run `npm start`
- [ ] Test: Search for "Oslo" in create request form
- [ ] Verify: Address suggestions appear

**Done!** App is ready for development.

---

## 🔑 API Key Locations

```
Development:   .env file (PROTECTED - not in git)
Staging:       Cloud Function env vars (COMING SOON)
Production:    Cloud Function env vars (AFTER MIGRATION)
NEVER:         Package.json, source code, git commits
```

---

## 🛑 DO's and DON'Ts

| ✅ DO                     | ❌ DON'T                       |
| ------------------------- | ------------------------------ |
| Store in `.env`           | Hardcode in source             |
| Use `EXPO_PUBLIC_` prefix | Commit `.env` to git           |
| Test offline mode         | Share key in Slack/email       |
| Rotate keys quarterly     | Use same key for dev+prod      |
| Log errors, not keys      | Include keys in error messages |
| Set GCP restrictions      | Leave API key unrestricted     |

---

## 🚨 Emergency Hotline

**API Key Compromised?**

1. **IMMEDIATELY**: Delete key in Google Cloud Console
2. **Within 5 min**: Create new API key
3. **Within 30 min**: Update all environments
4. **Within 1 hour**: Check billing for abuse

---

## 📞 Who to Ask

| Question                    | Contact       | Resource                       |
| --------------------------- | ------------- | ------------------------------ |
| "How do I set up locally?"  | Mobile team   | API_KEYS_DEPLOYMENT_GUIDE.md   |
| "What's our security plan?" | Security team | GOOGLE_PLACES_API_SECURITY.md  |
| "Is the key exposed?"       | DevOps team   | API_KEYS_SECURITY_CHECKLIST.md |
| "When do we migrate?"       | Tech lead     | API_KEYS_PROTECTION_SUMMARY.md |

---

## 🔐 Three Critical Files

1. **GOOGLE_PLACES_API_SECURITY.md** — _Architecture & strategy_
2. **API_KEYS_SECURITY_CHECKLIST.md** — _Audit & compliance_
3. **API_KEYS_DEPLOYMENT_GUIDE.md** — _Step-by-step procedures_

---

## 📊 Current Risk vs. Target

```
NOW:              FUTURE (3-6 months):
┌─────────────┐  ┌─────────────┐
│ App         │  │ App         │
│ (API key    │  │ (no key)    │
│  exposed)   │  │             │
└──────┬──────┘  └──────┬──────┘
       │                 │
    Direct API        Cloud Function
    (⚠️ RISKY)        (✅ SAFE)
       │                 │
    Google            Google API
    API              + Rate Limit
                     + Monitoring
```

---

## ✅ Before Production Launch

- [ ] Google Cloud API restrictions applied
- [ ] Billing alerts configured ($10, $50 limits)
- [ ] Offline mode tested (works without key)
- [ ] Team trained on key management
- [ ] Emergency procedures documented
- [ ] No API keys in git history

---

## 📱 For Your Phone

**Bookmark these**:

1. Google Cloud Console: https://console.cloud.google.com
2. Firebase Console: https://console.firebase.google.com
3. Upstash Console: https://console.upstash.com

---

## 🎓 Key Points to Remember

1. **`EXPO_PUBLIC_` keys are in the app bundle** ← Can be extracted by reverse engineering

2. **Offline fallback is your friend** ← App works without API key; shows Norwegian cities only

3. **Cloud Functions = Server-side security** ← Recommended for production

4. **Rotate production keys quarterly** ← Automated where possible

5. **Monitor billing closely** ← Catch quota abuse early

---

## 📞 Support

- **Dev Setup Questions**: See API_KEYS_DEPLOYMENT_GUIDE.md
- **Architecture Questions**: See GOOGLE_PLACES_API_SECURITY.md
- **Security Audit**: See API_KEYS_SECURITY_CHECKLIST.md
- **Emergency**: Call security team immediately + follow incident response guide

---

**Last Updated**: February 23, 2026  
**Owner**: Security Team  
**Status**: ✅ Implementation Complete
