---
title: Customizing STC Pay
sidebar_position: 6.0
---

# Customize STC Pay View

This guide shows how to build your own STC Pay UI while reusing the `STCPayViewModel` from the Moyasar iOS SDK.  
You are free to design any SwiftUI layout you want, as long as you call the exposed APIs and listen to the published state described below.

## 1. Create a `PaymentRequest`

First, prepare a `PaymentRequest` instance:

:::info
`PaymentRequest` can throw an error (for example, if your `apiKey` is invalid), so make sure to handle it properly.
:::

```swift
do {
    let paymentRequest = try PaymentRequest(
        apiKey: "pk_live_1234567",
        amount: 1000, // Amount in the smallest currency unit. For example: 10 SAR = 10 * 100 halalas
        currency: "SAR",
        description: "Flat White",
        metadata: [
            "order_id": .stringValue("ios_order_3214124"),
            "user_id": .integerValue(12345),
            "isPremiumUser": .booleanValue(true),
            "amount": .floatValue(15.5)
        ],
        manual: false,
        saveCard: false,
        allowedNetworks: [.mastercard, .visa, .mada], // Optional: set your supported networks
        payButtonType: .book // Optional: determines the button title. Default is `.pay`
    )
} catch {
    // Handle the error here (e.g. show an error in your view model / UI)
    fatalError("Invalid API key 🙁 \(error)")
}
```

## 2. Build Your Own Custom STC Pay View

When creating your own UI, keep these points in mind.  
`STCPayViewModel` exposes all the logic you need; your view just needs to:

1. **Start the payment using the mobile number**

   Call `initiatePayment()` when the user taps the Pay button in the mobile number step:

   ```swift
   Task {
       await viewModel.initiatePayment()
   }
   ```

2. **Submit the OTP**

   Call `submitOtp()` when the user enters a valid OTP and taps the Confirm button:

   ```swift
   Task {
       await viewModel.submitOtp()
   }
   ```

3. **Switch between steps using `screenStep`**

   There are two steps in the STC Pay flow:

   - `.mobileNumber` — user enters their mobile number
   - `.otp` — user enters the OTP received via SMS

   Use the `screenStep` property to decide which content to show:

   ```swift
   switch viewModel.screenStep {
   case .mobileNumber:
       phoneNumberTextFieldView()
   case .otp:
       otpTextFieldView()
   }
   ```

4. **Listen to the loading state**

   Use `viewModel.isLoading` to show/hide a loading indicator or disable your buttons
   while a request is in progress.

:::info
Now you have `initiatePayment()`, `submitOtp()`, `screenStep`, `viewModel.isLoading` and `STCResultCallback` now you have everything to setup your own view
:::

### Example: SwiftUI Custom STC Pay View

You can either inject an existing `STCPayViewModel`, or let your custom view create it from a `PaymentRequest`.

** – Provide a `PaymentRequest` and callback:**

```swift
let paymentRequest = try createSTCPaymentRequest()

MyCustomSTCPayView(paymentRequest: paymentRequest) { result in
    handleSTCResult(result)
}
```

:::info

- View [Custom SwiftUI example](https://github.com/moyasar/moyasar-ios-sdk/blob/master/SwiftUiDemo/SwiftUiDemo/Custom%20View/CustomSTCPayView.swift) for the full example

- View [Custom UIKit example](https://github.com/moyasar/moyasar-ios-sdk/blob/master/UIKitDemo/UIKitDemo/CustomSTCPayView.swift) for the full example
  :::

## 3. Handling the Payment Result

Your result callback will receive a `Result<ApiPayment, MoyasarError>`.  
You can inspect the payment status and handle success/failure accordingly:

```swift
func handleSTCResult(_ result: Result<ApiPayment, MoyasarError>) {
    switch result {
    case let .success(payment):
        if payment.status == .paid {
            print("Payment paid successfully")
        } else if payment.status == .failed {
            print("Payment failed")
        }

    case let .failure(error):
        print("Something went wrong: \(encloseMoyasarError(error).localizedDescription)")
    }
}
```

:::info
For more details about the possible payment statuses, see:  
[Payment Status Reference](/api/payments/payment-status-reference)
:::
