---
title: Testing
sidebar_position: 7
---

# Testing

Test your integration using Moyasar's sandbox environment. No real money is charged.

---

## Test API Key

Use your test API key (starts with `pk_test_`) for sandbox testing:

```swift
apiKey: "pk_test_YOUR_TEST_KEY"
```

[Get your API keys](/guides/dashboard/get-your-api-keys)

---

## Credit Card Testing

Use the [Moyasar test cards](/guides/card-payments/test-cards) for sandbox credit card payments.

### Common Test Cards

| Card Number | Expected Result |
|-------------|-----------------|
| `4111 1111 1111 1111` | Success |
| `4000 0000 0000 0002` | Requires 3DS authentication |
| `5555 5555 5555 4444` | Success (Mastercard) |

### Test Card Details

When using test cards, you can use any:
- **Expiry date** in the future
- **CVV** (3 digits)
- **Cardholder name**

---

## Apple Pay Testing

:::warning
Apple Pay testing **requires a physical device**. The simulator does not support Apple Pay.
:::

### Setup for Testing

1. Use a **test API key** (`pk_test_`)
2. Add your **actual card** to the device's Wallet app
3. No real charges will be processed in the test environment

### Why Apple Pay Requires a Physical Device

| Limitation | Description |
|------------|-------------|
| **Secure Element** | Apple Pay uses a hardware component not available in the simulator |
| **Card Provisioning** | Real cards must be added to Wallet, which the simulator cannot do |
| **Biometric Authentication** | Face ID / Touch ID require physical hardware |
| **NFC** | Contactless payment simulation is not supported in the simulator |

See [Apple Pay Testing Guide](/guides/apple-pay/testing) for detailed testing steps.

---

## STC Pay Testing

Use the sandbox OTP codes to test different STC Pay scenarios:

| OTP | Result |
|-----|--------|
| `123456` | Success |
| `000000` | Success |
| `111111` | Insufficient Funds |
| `222222` | Daily Limit Exceeded |
| `333333` | Transaction Limit Exceeded |
| `444444` | Timeout |
| Any other | Invalid OTP |

---

## Next Steps

- [Basic Integration](/sdk/ios/basic-integration) — Accept your first payment
- [Apple Pay Integration](/sdk/ios/apple-pay-payments-integration) — Add wallet payments
- [STC Pay Integration](/sdk/ios/stc-pay-integration) — Add STC Pay support