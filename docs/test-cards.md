---
title: Test Cards
sidebar_position: 4.0
---

# Test Cards

Moyasar provides a sandbox environment for testing credit card payments without the need to have a live account
or use real card numbers. This allows you to test your integration and ensure that everything is
working correctly before going live with actual payments.

## Before You Start

You can use any of the cards below to simulate different payment scenarios.

:::warning
Using any card that is not listed below will result in a failed payment.
:::

## Card Info

The following fields must contain syntactically correct values:

| Field | Value                                        |
| ----- | -------------------------------------------- |
| Name  | Use any name made of at least two words      |
| Year  | Any future year                              |
| Month | Any future month relative the expiry year    |
| CVC   | Any Three digits code (Four digits for Amex) |

## Mada

| Card Number        | Status     | Message                            | Response Code | 3DS Note |
| ------------------ | ---------- | ---------------------------------- | ------------- | -------- |
| `4201320111111010` | **paid**   | APPROVED                           | 00            | ----     |
| `4201320000013020` | **failed** | UNSPECIFIED FAILURE                | 99            | ----     |
| `4201320000311101` | **failed** | INSUFFICIENT FUNDS                 | 51            | ----     |
| `4201320131000508` | **failed** | DECLINED: LOST CARD                | 41            | ----     |
| `4201321234411220` | **failed** | DECLINED                           | 05            | ----     |
| `4201322267774310` | **failed** | DECLINED: EXPIRED CARD             | 54            | ----     |
| `4201326324640570` | **failed** | DECLINED: EXCEEDS WITHDRAWAL LIMIT | 61            | ----     |
| `4201321144311528` | **failed** | DECLINED: STOLEN CARD              | 43            | ----     |

## Visa

| Card Number        | Status     | Message                                                                                                      | Response Code | 3DS Note                                |
| ------------------ | ---------- | ------------------------------------------------------------------------------------------------------------ | ------------- | --------------------------------------- |
| `4111118250252531` | **failed** | 3DS: attempted but not available, please ensure that you have enabled Online Purchase from your bank portal. | ----          | ECI 06                                  |
| `4111114005765430` | **paid**   | APPROVED                                                                                                     | 00            | Frictionless Authentication             |
| `4111111111111111` | **paid**   | APPROVED                                                                                                     | 00            | ----                                    |
| `4111113343111067` | **failed** | 3DS service error occurred.                                                                                  | ----          | 3DS fails during enrollement check      |
| `4111116611600661` | **failed** | The card is not enrolled in 3DS service.                                                                     | ----          | ----                                    |
| `4111112205628150` | **failed** | 3DS service error occurred.                                                                                  | ----          | 3DS fails during authentication attempt |
| `4111115784228433` | **failed** | The authentication attempt was rejected by the issuer bank.                                                  | ----          | ----                                    |
| `4111115620358287` | **failed** | The authentication is unavailable, please try again later or contact issuer bank if problem persisted.       | ----          | ----                                    |
| `4123120000000000` | **failed** | UNSPECIFIED FAILURE                                                                                          | 99            | ----                                    |
| `4123120001090000` | **failed** | INSUFFICIENT FUNDS                                                                                           | 51            | ----                                    |
| `4123450131000508` | **failed** | DECLINED: LOST CARD                                                                                          | 41            | ----                                    |
| `4123120001090109` | **failed** | DECLINED                                                                                                     | 05            | ----                                    |
| `4123128518640738` | **failed** | DECLINED: EXPIRED CARD                                                                                       | 54            | ----                                    |
| `4123123033308648` | **failed** | DECLINED: EXCEEDS WITHDRAWAL LIMIT                                                                           | 61            | ----                                    |
| `4123125276780003` | **failed** | DECLINED: STOLEN CARD                                                                                        | 43            | ----                                    |

## Mastercard

| Card Number        | Status     | Message                            | Response Code | 3DS Note |
| ------------------ | ---------- | ---------------------------------- | ------------- | -------- |
| `5421080101000000` | **paid**   | APPROVED                           | 00            | ----     |
| `5105105105105100` | **failed** | UNSPECIFIED FAILURE                | 99            | ----     |
| `5457210001000092` | **failed** | INSUFFICIENT FUNDS                 | 51            | ----     |
| `5204010101000000` | **failed** | DECLINED: LOST CARD                | 41            | ----     |
| `5204730000002514` | **failed** | DECLINED                           | 05            | ----     |
| `5105107550274126` | **failed** | DECLINED: EXPIRED CARD             | 54            | ----     |
| `5105106475101067` | **failed** | DECLINED: EXCEEDS WITHDRAWAL LIMIT | 61            | ----     |
| `5105107304607225` | **failed** | DECLINED: STOLEN CARD              | 43            | ----     |

## American Express

| Card Number       | Status     | Message                            | Response Code | 3DS Note |
| ----------------- | ---------- | ---------------------------------- | ------------- | -------- |
| `340000000900000` | **paid**   | APPROVED                           | 00            | ----     |
| `371111111111114` | **failed** | UNSPECIFIED FAILURE                | 99            | ----     |
| `340033000000000` | **failed** | INSUFFICIENT FUNDS                 | 51            | ----     |
| `340012340501000` | **failed** | DECLINED: LOST CARD                | 41            | ----     |
| `340033000000133` | **failed** | DECLINED                           | 05            | ----     |
| `340000018441278` | **failed** | DECLINED: EXPIRED CARD             | 54            | ----     |
| `340000753060788` | **failed** | DECLINED: EXCEEDS WITHDRAWAL LIMIT | 61            | ----     |
| `340000418501838` | **failed** | DECLINED: STOLEN CARD              | 43            | ----     |
