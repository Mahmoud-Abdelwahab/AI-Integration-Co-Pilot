---
title: Customizing Credit Card View
sidebar_position: 4.0
---

# Customizing Credit Card View

Use the `create` method in the `PaymentService` class as follows:

```swift
let paymentService = PaymentService(apiKey: "pk_live_1234567")

// After creating your Custome UI you have to initilaize the ApiCreditCardSource
let source = ApiCreditCardSource(
    name: "John Doe",
    number: "4111111111111111",
    month: "09",
    year: "25",
    cvc: "456",
    manual: "false",
    saveCard: "false"
)

let paymentRequest = ApiPaymentRequest(
    amount: 1000,
    currency: "SAR",
    description: "Flat White",
    callbackUrl: "https://sdk.moyasar.com/return",
    source: ApiPaymentSource.creditCard(source),
    metadata: ["sdk": "ios", "order_id": "ios_order_3214124"]
)

Task {
    do {
        let payment = try await paymentService.createPayment(paymentRequest)
        DispatchQueue.main.async {
            self.startPaymentAuthProcess(payment)
        }
    }   catch let error as MoyasarError {
        print("Payment creation error: \(error )")
        self.handlePaymentError(error)
    } catch {
        print("An unexpected error occurred: \(error)")
        // handleUnexpectedError(error) // Add your general error handling here
    }
}

func startPaymentAuthProcess(_ payment: ApiPayment) {
    // ...
}

func handlePaymentError(_ error: MoyasarError) {
    // Handle all MoyasarError enum cases
}
```

:::info
Make sure to add the `'sdk'` field with the value of `'ios'` in `ApiPaymentRequest` metadata dictionary field. (Only when creating a custom UI)
:::

Now when the payment is initiated successfully you need to initialize the 3DS web view as follows:

```swift
func startPaymentAuthProcess(_ payment: ApiPayment) {
    guard payment.isInitiated() else {
        // Handle case
        // Payment status could be paid, failed, authorized, etc...
        return
    }

    guard case let .creditCard(source) = payment.source else {
        // Handle error
        return
    }

    guard let transactionUrl = source.transactionUrl, let url = URL(string: transactionUrl) else {
        // Handle error
        return
    }

    showWebView(url)
}

func showWebView(_ url: URL) {
    // Initialize the 3DS web view you can check the CustomViewModel in the SwiftUiDemo for more details.
}
```

:::info
View [Custom View Example](https://github.com/moyasar/moyasar-ios-sdk/tree/master/SwiftUiDemo/SwiftUiDemo/Custom%20View) for the full example
:::

:::info
[Payment Status Reference](/api/payments/payment-status-reference)
:::
