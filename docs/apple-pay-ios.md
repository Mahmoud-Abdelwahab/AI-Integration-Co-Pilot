---
title: Apple Pay iOS
sidebar_position: 4.0
---

# Apple Pay iOS

This is a simple guide for using Apple's **PassKit** for implementing Apple Pay in native iOS apps. This guide
is intended for people who want to have full control over the experience, and if you are looking for an easy
setup, please check our [iOS SDK here](/sdk/ios/installation).

## Who is this guide for?

- Users looking for advanced Apple Pay features.

## Before Starting

- [Register](https://dashboard.moyasar.com/register) for a free account in Moyasar Dashboard
- You must have an **Apple Developer Account** with an active subscription.
- Your payment processing certificate is registered with Moyasar, follow this guide: [Apple Pay Using Developer Account](/guides/apple-pay/apple-developer-account)

## Integration

To start Apple Pay integration, please follow the guide here
[Apple Developer Documentation](https://developer.apple.com/documentation/passkit).

## Payment Authorization

When the user authorizes the payment using Face ID or Touch ID on their iOS device, the `didAuthorizePayment` event
will be dispatched. In this step you need to post the `paymentData` to Moyasar found within
the `PKPayment` object. Here is an example:

```swift
struct ApplePaySource: Codable {
    var type = "applepay"
    var token: String
}

struct PaymentRequest: Codable {
    var amount: Int
    var description: String
    var publishable_api_key: String
    var source: ApplePaySource
}

let payment: PKPayment = // Payment object we got in the didAuthorizePayment event
let source = ApplePaySource(token: String(data: payment.token.paymentData, encoding: .utf8))
let request = PaymentRequest(
    amount: 100, // 100 Halalas == SAR 1.00
    description: "iOS Apple Pay Payment",
    publishable_api_key: "pk_live_12345",
    source: source)
```

Now you need to serialize the `request` object as JSON and send it to Moyasar API like it was described
in [Apple Pay on Websites](/guides/apple-pay/apple-pay-web).
