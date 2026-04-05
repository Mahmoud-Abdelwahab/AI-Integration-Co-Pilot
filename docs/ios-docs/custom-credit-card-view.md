---
title: Custom Credit Card UI
sidebar_position: 5
---

# Custom Credit Card UI

Build your own credit card form while using Moyasar's payment processing APIs.

---

## Overview

To create a custom credit card form:

1. Collect card details with your own UI
2. Create an `ApiCreditCardSource` with the card data
3. Submit the payment via `PaymentService`
4. Handle 3DS authentication with a web view

---

## Step 1: Create the Payment Service

```swift
import MoyasarSdk

class CustomPaymentViewModel: ObservableObject {
    private let paymentService: PaymentService
    
    init() {
        paymentService = PaymentService(apiKey: "pk_test_YOUR_API_KEY")
    }
}
```

---

## Step 2: Create the Card Source and Payment Request

```swift
// Create the card source from your form inputs
let cardSource = ApiCreditCardSource(
    name: "John Doe",
    number: "4111111111111111",
    month: "09",
    year: "25",
    cvc: "456",
    manual: "false",
    saveCard: "false"
)

// Create the payment request
let paymentRequest = try PaymentRequest(
    apiKey: "pk_test_YOUR_API_KEY",
    amount: 1000,
    currency: "SAR",
    description: "Order #12345"
)

// Wrap it in an ApiPaymentRequest
let apiPaymentRequest = ApiPaymentRequest(
    paymentRequest: paymentRequest,
    callbackUrl: "https://sdk.moyasar.com/return",
    source: ApiPaymentSource.creditCard(cardSource)
)
```

:::info
Include `"sdk": "ios"` in the `ApiPaymentRequest` metadata when using a custom UI.
:::

---

## Step 3: Submit the Payment

```swift
func submitPayment() async {
    do {
        let payment = try await paymentService.createPayment(apiPaymentRequest)
        await MainActor.run {
            start3DSAuthentication(payment)
        }
    } catch let error as MoyasarError {
        print("Payment creation failed: \(error)")
    } catch {
        print("Unexpected error: \(error)")
    }
}
```

---

## Step 4: Handle 3DS Authentication

If the payment requires 3DS authentication, redirect to the transaction URL:

```swift
func start3DSAuthentication(_ payment: ApiPayment) {
    // Check if payment is still in initiated state
    guard payment.isInitiated() else {
        // Payment already completed (paid, failed, authorized, etc.)
        return
    }
    
    // Extract the transaction URL
    guard case let .creditCard(source) = payment.source,
          let transactionUrl = source.transactionUrl,
          let url = URL(string: transactionUrl) else {
        return
    }
    
    // Present your web view with the 3DS URL
    present3DSWebView(url)
}
```

---

## Step 5: Present the 3DS Web View

Create a web view to handle the 3DS authentication flow:

```swift
import SwiftUI
import MoyasarSdk
import WebKit

struct PaymentAuthView: UIViewRepresentable {
    let url: URL
    let onResult: (WebViewResult) -> Void
    
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.navigationDelegate = context.coordinator
        webView.load(URLRequest(url: url))
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(onResult: onResult)
    }
    
    class Coordinator: NSObject, WKNavigationDelegate {
        let onResult: (WebViewResult) -> Void
        
        init(onResult: @escaping (WebViewResult) -> Void) {
            self.onResult = onResult
        }
        
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // Check if URL matches callback URL to detect completion
            if let url = webView.url, url.absoluteString.contains("sdk.moyasar.com/return") {
                // Parse the result from URL parameters
                // Call onResult with the appropriate WebViewResult
            }
        }
    }
}
```

---

## Step 6: Handle the Web View Result

```swift
func handleWebViewResult(_ result: WebViewResult) {
    switch result {
    case .completed(let info):
        // Update your payment object with the result
        currentPayment?.status = ApiPaymentStatus(rawValue: info.status)
        
        if currentPayment?.status == .paid {
            print("Payment successful: \(currentPayment!.id)")
        } else if case let .creditCard(source) = currentPayment?.source {
            print("Payment failed: \(source.message ?? "Unknown")")
        }
    case .failed(let error):
        print("3DS authentication failed: \(error.localizedDescription)")
    }
}
```

---

## Complete Example

See the full implementation in the demo projects:

- [SwiftUI Custom View Example](https://github.com/moyasar/moyasar-ios-sdk/tree/master/SwiftUiDemo/SwiftUiDemo/Custom%20View)
- [UIKit Custom View Example](https://github.com/moyasar/moyasar-ios-sdk/tree/master/UIKitDemo/UIKitDemo)

---

## Next Steps

- [Testing Guide](/sdk/ios/testing) — Test with sandbox cards
- [Payment Status Reference](/api/payments/payment-status-reference) — Understand payment statuses