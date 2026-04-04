---
title: STC Pay
sidebar_position: 5.0
---

# STC Pay Integration

## Create Payment Request

We need to prepare a `PaymentRequest` object:

:::info
It may throw an error if your apiKey is not valid.
:::

```swift
 do {
      let paymentRequest = try  PaymentRequest(
      apiKey: "pk_live_1234567",
      amount: 1000, // Amount in the smallest currency unit For example: 10 SAR = 10 * 100 Halalas
      currency: "SAR",
      description: "Flat White",
      metadata: [ "order_id": .stringValue("ios_order_3214124"),
                  "user_id": .integerValue(12345),
                  "isPremiumUser": .booleanValue(true),
                  "amount": .floatValue(15.5)
                ],
      manual: false,
      saveCard: false,
      allowedNetworks: [.mastercard, .visa, .mada], // Optional set your supported networks
      payButtonType: .book // //Optional; This determines the button title. By default, it is set to `.pay`
      )
    } catch {
        // Handle error here, show error in the view model
        fatalError("Invalid api key 🙁", error)
    }
```

## 2- Create STC View

### SwiftUI STC Payments

The SDK provides a **SwiftUI** view called `STCPayView` that allows you to easily create a STC Form.

```swift
STCPayView(paymentRequest: paymentRequest) { result in
                        handleSTCResult(result)
                    }
```

### UIKit STC Payments

If you are using UIKit you will need to create a wrapper to host the SwiftUI `STCPayView` view:

```swift
    func makeCreditCardView() {
        let stcPayView = STCPayView(paymentRequest: paymentRequest) { result in
                        handleSTCResult(result)
                    }

        let stcPayHostingController = UIHostingController(rootView: stcPayView)
        stcPayHostingController.view.translatesAutoresizingMaskIntoConstraints = false

        addChild(stcPayHostingController)
        view.addSubview(stcPayHostingController.view)
        stcPayHostingController.didMove(toParent: self)

        NSLayoutConstraint.activate([
            stcPayHostingController.view.topAnchor.constraint(equalTo: view.topAnchor),
            stcPayHostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            stcPayHostingController.view.widthAnchor.constraint(equalTo: view.widthAnchor),
            stcPayHostingController.view.heightAnchor.constraint(equalTo: view.heightAnchor)
        ])
    }
```

:::info
Don't forget to import `MoyasarSdk`.
:::

## 3- Handling Payment result

```swift
    func handleSTCResult(_ result:  Result<ApiPayment, MoyasarError>) {
        switch (result) {
        case let .success(payment):
            if payment.status == .paid {
                print("Payment Paid Successfully")
            } else if payment.status == .failed {
                print("Payment failed")
            }
        case let .failure(error):
            print("Something went wrong: \(encloseMoyasarError(error).localizedDescription)")
        }
    }
```

:::info
[Payment Status Reference](/api/payments/payment-status-reference)
:::
