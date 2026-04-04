---
title: Testing
sidebar_position: 7.0
---

# Testing

### Credit Cards

Moyasar provides a sandbox environment for testing credit card payments without charging any real money. This allows you to test your integration and ensure that everything is working correctly before going live with actual payments. Learn more about [our testing cards](/guides/card-payments/test-cards)

### Apple Pay

:::warning[Important]
Testing using a simulator will not work! Learn how to test apply pay step by step in [Apple Pay testing](/guides/apple-pay/testing).
:::

:::info
Important: Test Payment Setup
Before proceeding, please add your actual card to your wallet for testing purposes. However, ensure you are using our test environment by verifying:

- The API key must begin with pk*test*
- No real charges will be processed in this test environment
- Your actual card details remain secure during testing

⚠️ Note: This configuration allows you to safely test the payment flow using real card credentials in a sandbox environment.
:::

Apple Pay testing in a simulator does not work due to several technical limitations tied to how Apple Pay operates in a real environment. Here’s a detailed explanation:

**1. Secure Element:** Apple Pay relies on a hardware component called the **Secure Element**, which is embedded in iOS devices. The iOS simulator, however, does not have access to this hardware component, making it impossible to simulate the secure, end-to-end payment process that Apple Pay requires.

**2. Provisioning of Payment Cards:** To use Apple Pay, payment cards must be provisioned into the Wallet app, which involves validating the card with the issuing bank and securely storing the card information in the **Secure Element**. This process cannot be replicated in the simulator since it does not support adding real or test payment cards to Wallet.

**3. Real-World Authentication:** Apple Pay transactions require real-world authentication methods like **Face ID**, **Touch ID**, or a **passcode**, to confirm payments. These authentication methods are tied to the physical hardware of iOS devices. The simulator cannot replicate these biometric authentications because it lacks the necessary hardware.

**4. Encryption and Security Protocols:** Apple Pay uses advanced encryption and security protocols that are managed by the **Secure Enclave**, another hardware-based security feature present in physical devices. The simulator does not have a **Secure Enclave**, so it cannot properly handle the encryption processes required for **Apple Pay** transactions.

**5. Device-Specific Features:** Certain features of Apple Pay, like near-field communication **(NFC)** for contactless payments, are directly tied to the physical device’s hardware. Since the simulator lacks these hardware capabilities, it cannot simulate **NFC-based** transactions or the user experience associated with making payments using Apple Pay.

Because of these reasons, developers must test Apple Pay on a physical iOS device to accurately simulate the payment flow and ensure the integration works as expected.

### STC Pay

| Sandbox OTP | Context                    |
| ----------- | -------------------------- |
| 123456      | Success                    |
| 000000      | Success                    |
| 111111      | Insufficient Funds         |
| 222222      | Daily Limit Exceeded       |
| 333333      | Transaction Limit Exceeded |
| 444444      | Timeout                    |
| Other       | Invalid OTP                |
