---
title: STC Pay Integration
sidebar_position: 4
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# STC Pay Integration

Accept payments via STC Pay using the SDK's built-in `STCPayView`.

---

## Step 1: Create a Payment Request

Create a `PaymentRequest` configured for STC Pay:

```swift
import MoyasarSdk

func createSTCPaymentRequest() -> PaymentRequest {
    do {
        return try PaymentRequest(
            apiKey: "pk_test_YOUR_API_KEY",
            amount: 1000,           // 10.00 SAR (amount in smallest currency unit)
            currency: "SAR",
            description: "Order #12345",
            metadata: [
                "order_id": .stringValue("ios_order_3214124"),
                "user_id": .integerValue(12345)
            ],
            manual: false,
            saveCard: false
        )
    } catch {
        fatalError("Invalid API key: \(error)")
    }
}
```

---

## Step 2: Add the STC Pay View

<Tabs>
  <TabItem value="swiftui" label="SwiftUI">

```swift
import SwiftUI
import MoyasarSdk

struct STCPayScreen: View {
    var body: some View {
        STCPayView(
            paymentRequest: createSTCPaymentRequest()
        ) { result in
            handleSTCResult(result)
        }
    }
    
    func handleSTCResult(_ result: Result<ApiPayment, MoyasarError>) {
        switch result {
        case .success(let payment):
            handleSTCPayment(payment)
        case .failure(let error):
            handleSTCError(error)
        }
    }
}
```

  </TabItem>
  <TabItem value="uikit" label="UIKit">

```swift
import UIKit
import SwiftUI
import MoyasarSdk

class STCPayViewController: UIViewController {
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupSTCPayView()
    }
    
    func setupSTCPayView() {
        let stcPayView = STCPayView(
            paymentRequest: createSTCPaymentRequest()
        ) { result in
            self.handleSTCResult(result)
        }
        
        let hostingController = UIHostingController(rootView: stcPayView)
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        
        addChild(hostingController)
        view.addSubview(hostingController.view)
        hostingController.didMove(toParent: self)
        
        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    func handleSTCResult(_ result: Result<ApiPayment, MoyasarError>) {
        switch result {
        case .success(let payment):
            handleSTCPayment(payment)
        case .failure(let error):
            handleSTCError(error)
        }
    }
}
```

  </TabItem>
</Tabs>

---

## Step 3: Handle the Payment Result

```swift
func handleSTCPayment(_ payment: ApiPayment) {
    switch payment.status {
    case .paid:
        print("STC Pay successful: \(payment.id)")
        // Navigate to success screen
    case .failed:
        print("STC Pay failed")
        // Show error to user
    default:
        print("STC Pay status: \(payment.status)")
    }
}

func handleSTCError(_ error: MoyasarError) {
    switch error {
    case .apiError(let apiError):
        print("API error: \(apiError.message ?? "Unknown")")
    case .networkError:
        print("Network connection failed")
    default:
        print("STC Pay error: \(error)")
    }
}
```

---

## STC Pay Flow

The STC Pay payment flow consists of two steps:

1. **Mobile Number Entry** — User enters their STC Pay registered phone number
2. **OTP Verification** — User enters the OTP received via SMS

The `STCPayView` handles this flow automatically. For custom UI implementation, see [Customizing STC Pay](/sdk/ios/custom-stc-pay).

---

## Next Steps

- [Customizing STC Pay](/sdk/ios/custom-stc-pay) — Build your own STC Pay UI
- [Testing Guide](/sdk/ios/testing) — Test with sandbox OTP codes
- [Payment Status Reference](/api/payments/payment-status-reference) — Understand payment statuses