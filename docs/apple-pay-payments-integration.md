---
title: Apple Pay Payments Integration
sidebar_position: 3.0
---

# Apple Pay Payments Integration

## Apple Pay Integration Guide

This guide walks you through integrating **Apple Pay** payments into your Flutter application using the Moyasar Flutter SDK. Apple Pay enables users to pay securely using Face ID or Touch ID on supported iOS devices.

## Prerequisites

Before you begin, ensure you have:

1. **Moyasar account** — [Sign up](https://dashboard.moyasar.com/register/new) if you haven't already
2. **Publishable API key** — [Get your API keys](/guides/dashboard/get-your-api-keys)
3. **Apple Developer Account** — With an active subscription
4. **iOS device or simulator** — Apple Pay requires a real device for testing (simulator has limited support)
5. **macOS with Xcode** — Required for iOS configuration

:::info Platform Support

Apple Pay is **iOS only**. The Apple Pay button will not appear on Android. Use [Samsung Pay](/sdk/flutter/samsung-pay-integration) for Android wallet payments.

:::

## Apple Pay Setup

Before integrating in your app, complete the Apple Pay setup:

1. [Create a Merchant ID](https://developer.apple.com/documentation/apple_pay_on_the_web/configuring_your_environment) in your Apple Developer Account
2. [Configure the Payment Processing Certificate](/guides/apple-pay/apple-developer-account) with Moyasar. The flow involves four steps (download → upload → download → upload):
   - **Step 1 — Download CSR from Moyasar:** Go to [Moyasar Dashboard](https://dashboard.moyasar.com) → **Settings** → **Apple Pay - Certificate** → **Request CSR** → **Download CSR**. Save the `.csr` file to your computer.
   - **Step 2 — Upload CSR to Apple:** In [Apple Developer](https://developer.apple.com/account) → your **Merchant ID** → **Apple Pay Payment Processing Certificate** → **Create Certificate** → upload the `.csr` file you downloaded. When asked about China Mainland, select **No**.
   - **Step 3 — Download signed certificate from Apple:** After Apple signs it, **Download** the `.cer` file to your computer.
   - **Step 4 — Upload to Moyasar:** Go back to Moyasar Dashboard → **Apple Pay - Certificate** → **Upload File** → select the `apple_pay.cer` file → **Upload**. Once it matches, the certificate will be active.
3. [Enable Apple Pay in Xcode](https://help.apple.com/xcode/mac/current/#/dev44ce8ef13) for your app:
   - Add the **Apple Pay** capability to your app
   - Select your Merchant ID
   - Ensure your App ID has Apple Pay enabled in the Apple Developer Portal
4. Note your **Merchant ID** — you will need it for `ApplePayConfig`

:::warning China Mainland

When creating the Payment Processing Certificate in Apple Developer, if asked whether the merchant is in **China Mainland**, select **No**. Moyasar does not support the RSA algorithm used for China.

:::

You can follow [Offering Apple Pay in Your App](https://developer.apple.com/documentation/passkit/apple_pay/offering_apple_pay_in_your_app) to implement **Apple Pay** within your app.

```swift
 func present() {
        items = [
            PKPaymentSummaryItem(label: "Moyasar", amount: 1.00, type: .final)
        ]

        let request = PKPaymentRequest()

        request.paymentSummaryItems = items
        request.merchantIdentifier = "merchant.mysr.fghurayri"
        request.countryCode = "SA"
        request.currencyCode = "SAR"
        request.supportedNetworks = [ .amex, .masterCard, .visa, .mada ]
        request.merchantCapabilities = [
            .capability3DS,
            .capabilityCredit,
            .capabilityDebit
        ]

        controller = PKPaymentAuthorizationController(paymentRequest: request)
        controller?.delegate = self
        controller?.present(completion: {(p: Bool) in  // OR add your custom navigation as needed .
            print("Presented: " + (p ? "Yes" : "No"))
        })
    }
```

:::info
If you want to know how to use apply pay button please check the component section in this docs .
:::

- When the user authorizes the payment using **Face ID** or **Touch ID** on their iOS device, the `didAuthorizePayment` event will be dispatched. In this step, you must pass the `token` to `ApplePayService` found within the `PKPayment` object. Here is an example:

```swift
  func paymentAuthorizationController(_ controller: PKPaymentAuthorizationController, didAuthorizePayment payment: PKPayment, handler completion: @escaping (PKPaymentAuthorizationResult) -> Void) {
        Task {
            do {
                let apiPaymentResult = try await applePayService!.authorizePayment(request: paymentRequest, token: payment.token)
                handleCompletedPaymentResult(apiPaymentResult, handler: completion)
            }  catch {
                // Handle the error case
                print(error)
                completion(PKPaymentAuthorizationResult(status: .failure, errors: [error]))
            }
        }
    }

    func handleCompletedPaymentResult(_ apiPaymentResult: ApiPayment, handler completion: @escaping (PKPaymentAuthorizationResult) -> Void) {
        print("Got payment, status: \(apiPaymentResult.status)")
        print(apiPaymentResult.status)
        print(apiPaymentResult.id)
        switch (apiPaymentResult.status) {
        case .paid:
            completion(PKPaymentAuthorizationResult(status: .success, errors: []))
        case .failed:
            let message: String = if case let .applePay(source) = apiPaymentResult.source {
                source.message ?? "unspecified"
            } else {
                "Returned API source is not Apple Pay"
            }
            completion(PKPaymentAuthorizationResult(status: .failure, errors: [DemoError.paymentError(message)]))
        default:
            completion(PKPaymentAuthorizationResult(status: .failure, errors: [DemoError.paymentError("Unexpected status returned by API")]))
        }
    }
```

:::info

- Don't forget:
  - Call the `completion`. If, for some reason, the closure is not called, it would result in the Apple Pay sheet hanging or other unexpected behavior. Therefore, it's crucial to ensure that the completion is always called, regardless of the payment process outcome.
  - Import `PassKit`.

---

- An error will be printed if the API key format is incorrect.
  :::

* After the payment is finished, the `paymentAuthorizationControllerDidFinish` delegate function will be called; allowing you to `dismiss` the controller within it.
