---
title: Apple Pay Web
sidebar_position: 3.0
---

This guide will go through how to integrate Apple Pay JS API with Moyasar, we will go step by step through the process of **including Apple Pay's scripts**, **Creating the payment request**, **Validating the merchant's URL**, and finally **Authorizing the payment.**

## Who is this guide for?

- Users looking for advanced Apple Pay features.

## Before Starting

- [Create an account](https://dashboard.moyasar.com) with Moyasar, if you haven't already.
- Read through the following guides:
  - [Apple Developer Documentation](https://developer.apple.com/documentation/apple_pay_on_the_web).
  - [Apple Pay Demo](https://applepaydemo.apple.com/).
  - [Web Registration](/guides/apple-pay/web-registration).

## Display the Apple Pay Button

First, you need to include Apple Pay's script file into the web page:

```html
<head>
  <!---other scripts--->
  <script src="https://applepay.cdn-apple.com/jsapi/v1/apple-pay-sdk.js"></script>
</head>
```

Then, you need to set the styles for the Apple Pay button and include the button in your HTML:

```html
<style>
  apple-pay-button {
    --apple-pay-button-width: 150px;
    --apple-pay-button-height: 30px;
    --apple-pay-button-border-radius: 3px;
    --apple-pay-button-padding: 0px 0px;
    --apple-pay-button-box-sizing: border-box;
  }
</style>

<apple-pay-button
  buttonstyle="black"
  onclick="onApplePayButtonClicked()"
  type="plain"
  locale="en"></apple-pay-button>
```

:::tip

Learn more about Apple Pay button customizations here [Apple Pay Demo](https://applepaydemo.apple.com/).

:::

## Initiate Payment Session

```javascript
function onApplePayButtonClicked() {
  if (!ApplePaySession) {
    return;
  }

  // Define ApplePayPaymentRequest
  const applePayPaymentRequest = {
    countryCode: 'SA',
    currencyCode: 'SAR',
    supportedNetworks: ['mada', 'visa', 'masterCard'],
    merchantCapabilities: ['supports3DS', 'supportsDebit', 'supportsCredit'],
    total: {
      label: 'Abdullah Store',
      amount: '99.95',
    },
  };

  // Create Apple Pay Session
  const session = new ApplePaySession(5, applePayPaymentRequest);

  // Provide Merchant Validation
  // ...

  // Payment Authorization
  // ...

  session.begin();
}
```

:::tip

Add `amex` to the `supportedNetworks` list if your account supports accepting American Express cards.

:::

## Merchant Validation

```javascript
function onApplePayButtonClicked() {
  if (!ApplePaySession) {
    return;
  }

  // Define ApplePayPaymentRequest ...

  // Create Apple Pay Session
  // ...

  // Provide Merchant Validation
  session.onvalidatemerchant = async (event) => {
    const body = {
      validation_url: event.validationURL,
      display_name: 'Abdullah Software',
      domain_name: window.location.hostname,
      publishable_api_key: 'pk_test_123456',
    };

    try {
      const response = await fetch('https://api.moyasar.com/v1/applepay/initiate', {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      session.completeMerchantValidation(await response.json());
    } catch (error) {
      session.completeMerchantValidation(error);
    }
  };

  // Payment Authorization
  // ...

  session.begin();
}
```

:::note

The previous example uses Moyasar API for merchant validation which saves your time by not requiring an Apple Developer
Account. This feature is described here at [Web Registration](/guides/apple-pay/web-registration).

:::

## Payment Authorization

In the `onpaymentauthorized` event, you will receive the encrypted payment token, which will be sent to Moyasar to complete the transaction. We will be using [Moyasar API](/api/api-introduction) for this.

### Create the request body to send to Moyasar

```javascript
function onApplePayButtonClicked() {
  if (!ApplePaySession) {
    return;
  }

  // Define ApplePayPaymentRequest ...

  // Create Apple Pay Session
  // ...

  // Provide Merchant Validation
  // ...

  // Payment Authorization
  session.onpaymentauthorized = async (event) => {
    const token = event.payment.token;

    // prepare request for moyasar
    let body = {
      amount: applePayPaymentRequest.total.amount * 100,
      currency: applePayPaymentRequest.currencyCode,
      description: 'My Awsome Order #1234',
      publishable_api_key: 'pk_test_123456',
      source: {
        type: 'applepay',
        token: token,
      },
      metadata: {
        order: '1234',
      },
    };

    // send the request
    const response = await fetch('https://api.moyasar.com/v1/payments', {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const responseJson = await response.json();

    if (!response.ok) {
      session.completePayment({
        status: ApplePaySession.STATUS_FAILURE,
        errors: [responseJson.message],
      });

      return;
    }

    if (responseJson.status != 'paid') {
      session.completePayment({
        status: ApplePaySession.STATUS_FAILURE,
        errors: [responseJson.source.message],
      });

      return;
    }

    // TODO: Report payment result to merchant backend
    // TODO: Add any merchant related bussiness logic here

    session.completePayment({
      status: ApplePaySession.STATUS_SUCCESS,
    });
  };

  session.begin();
}
```

## Handling Payment Sheet Cancellation (Optional)

The `ApplePaySession` object allows you to handle a special event when the user click away or dismisses the payment
sheet. This is useful when you need to run any custom business logic:

```javascript
function onApplePayButtonClicked() {
  if (!ApplePaySession) {
    return;
  }

  // Define ApplePayPaymentRequest
  // ...

  // Create Apple Pay Session
  // ...

  // Provide Merchant Validation
  // ...

  // Payment Authorization
  // ...

  session.oncancel = (event) => {
    // Handle payment cancellation here
  };

  session.begin();
}
```
