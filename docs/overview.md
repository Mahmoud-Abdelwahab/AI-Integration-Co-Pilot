---
id: overview
slug: /
title: Developer Documentation Overview
sidebar_label: Overview
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Moyasar Docs

Welcome to Moyasar Developer Documentation!

We will guide you through the process of integration and providing payments within your web or mobile application. Follow
these steps to get started.

:::info
Click [here](docs-hierarchy) if you would like an overview of the Developer Docs tree structure.
:::

## Create An Account

If you haven't created an account yet, please do so by visiting the sign up page then continue with the next step [Sign Up Here](https://dashboard.moyasar.com/register/new).

:::tip
Moyasar offers a **free** account for you to try the service in a sandbox environment. The sandbox environment will simulate
responses from the payment network to help you complete the full payment cycle before going live.
:::

## Prepare Your API Keys

After signing into your new account, you should be able to get your [API Keys](/guides/dashboard/get-your-api-keys)
from the settings page. API keys are used to authenticate all requests made to Moyasar API.

Learn more about authentication here: [Authentication](/api/authentication).

## Start Integration

It is time for you now to integrate the different payment methods within your application, Moyasar offers a set of tools
and libraries that will help you do this.

<Tabs>
  <TabItem value="web" label="Web Integration" default>
    <h3>Web Payments</h3>
    <p>Accept mada, Visa, Mastercard, and Apple Pay on your web application.</p>
    <p>Learn more: <a href="/guides/card-payments/basic-integration">Basic Integration Guide</a></p>
  </TabItem>
  <TabItem value="mobile" label="Mobile Integration">
    <h3>Mobile SDKs</h3>
    <p>Integrate payments within your iOS and Android applications.</p>
    <p>Learn more: <a href="/sdk/ios/installation">SDK Documentation</a></p>
  </TabItem>
  <TabItem value="ecommerce" label="E-Commerce">
    <h3>E-Commerce Plugins</h3>
    <p>Accept payments on major open-source e-commerce platforms.</p>
    <p>Learn more: <a href="/ecommerce">E-Commerce Integration</a></p>
  </TabItem>
</Tabs>

## Verify Your Integration

Now, you need to verify your integration by making a test API request to ensure it is functioning correctly using the [testing cards](/guides/card-payments/test-cards).

## Contact Support

Feel free to contact us at our support email support@moyasar.com

## Helpdesk

Checkout our [helpdesk](https://help.moyasar.com/en/) for FAQs or Live Chat.
