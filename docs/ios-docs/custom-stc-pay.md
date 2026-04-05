---
title: Custom STC Pay UI
sidebar_position: 6
---

# Custom STC Pay UI

Build your own STC Pay form while using the SDK's `STCPayViewModel` for payment processing.

---

## Overview

The `STCPayViewModel` exposes all the logic you need for STC Pay payments. Your custom view only needs to:

1. Display the appropriate step (mobile number or OTP)
2. Call the view model's methods
3. Listen to published state changes

---

## Step 1: Create a Payment Request

```swift
import MoyasarSdk

func createSTCPaymentRequest() -> PaymentRequest {
    do {
        return try PaymentRequest(
            apiKey: "pk_test_YOUR_API_KEY",
            amount: 1000,
            currency: "SAR",
            description: "Order #12345",
            metadata: [
                "order_id": .stringValue("ios_order_3214124")
            ]
        )
    } catch {
        fatalError("Invalid API key: \(error)")
    }
}
```

---

## Step 2: Create Your Custom View

Initialize your view with a `PaymentRequest` and a result callback:

```swift
import SwiftUI
import MoyasarSdk

struct MyCustomSTCPayView: View {
    @ObservedObject var viewModel: STCPayViewModel
    
    init(paymentRequest: PaymentRequest, callback: @escaping STCResultCallback) {
        self._viewModel = ObservedObject(
            wrappedValue: STCPayViewModel(
                paymentRequest: paymentRequest,
                resultCallback: callback
            )
        )
    }
    
    var body: some View {
        VStack(spacing: 16) {
            switch viewModel.screenStep {
            case .mobileNumber:
                phoneStep
            case .otp:
                otpStep
            }
        }
        .padding()
    }
}
```

---

## Step 3: Build the Mobile Number Step

```swift
private var phoneStep: some View {
    VStack(alignment: .leading, spacing: 12) {
        Text("Mobile Number")
            .font(.headline)
        
        TextField("05XXXXXXXX", text: $viewModel.mobileNumber)
            .keyboardType(.phonePad)
            .textFieldStyle(.roundedBorder)
        
        if !viewModel.isValidPhoneNumber && viewModel.showErrorHintView.value {
            Text("Invalid phone number")
                .foregroundColor(.red)
                .font(.caption)
        }
        
        Button(action: {
            Task {
                await viewModel.initiatePayment()
            }
        }) {
            if viewModel.isLoading {
                ProgressView()
            } else {
                Text("Pay")
                    .frame(maxWidth: .infinity)
            }
        }
        .disabled(!viewModel.isValidPhoneNumber)
        .buttonStyle(.borderedProminent)
    }
}
```

---

## Step 4: Build the OTP Step

```swift
private var otpStep: some View {
    VStack(alignment: .leading, spacing: 12) {
        Text("Enter OTP")
            .font(.headline)
        
        TextField("XXXXXX", text: $viewModel.otp)
            .keyboardType(.numberPad)
            .textFieldStyle(.roundedBorder)
        
        if !viewModel.isValidOtp && viewModel.showErrorHintView.value {
            Text("Invalid OTP")
                .foregroundColor(.red)
                .font(.caption)
        }
        
        Button(action: {
            Task {
                await viewModel.submitOtp()
            }
        }) {
            if viewModel.isLoading {
                ProgressView()
            } else {
                Text("Confirm")
                    .frame(maxWidth: .infinity)
            }
        }
        .disabled(!viewModel.isValidOtp)
        .buttonStyle(.borderedProminent)
    }
}
```

---

## STCPayViewModel Properties

### Published Properties

| Property | Type | Description |
|----------|------|-------------|
| `mobileNumber` | String | User's phone number (bind to your text field) |
| `otp` | String | User's OTP code (bind to your text field) |
| `screenStep` | STCStep | Current step: `.mobileNumber` or `.otp` |
| `isLoading` | Bool | True while a network request is in progress |
| `isValidPhoneNumber` | Bool | True if phone number passes validation |
| `isValidOtp` | Bool | True if OTP passes validation |
| `showErrorHintView` | Bool | Whether to show error hints |

### Methods

| Method | Description |
|--------|-------------|
| `initiatePayment()` | Submit the mobile number to initiate STC Pay payment |
| `submitOtp()` | Submit the OTP to complete the payment |

---

## Step 5: Handle the Payment Result

```swift
func handleSTCResult(_ result: Result<ApiPayment, MoyasarError>) {
    switch result {
    case .success(let payment):
        switch payment.status {
        case .paid:
            print("STC Pay successful: \(payment.id)")
        case .failed:
            print("STC Pay failed")
        default:
            print("STC Pay status: \(payment.status)")
        }
    case .failure(let error):
        print("STC Pay error: \(error)")
    }
}
```

---

## Complete Examples

See the full implementations in the demo projects:

- [SwiftUI Custom STC Pay Example](https://github.com/moyasar/moyasar-ios-sdk/blob/master/SwiftUiDemo/SwiftUiDemo/Custom%20View/CustomSTCPayView.swift)
- [UIKit Custom STC Pay Example](https://github.com/moyasar/moyasar-ios-sdk/blob/master/UIKitDemo/UIKitDemo/CustomSTCPayView.swift)

---

## Next Steps

- [Testing Guide](/sdk/ios/testing) — Test with sandbox OTP codes
- [Payment Status Reference](/api/payments/payment-status-reference) — Understand payment statuses