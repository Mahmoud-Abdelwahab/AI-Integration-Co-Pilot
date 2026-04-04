---
title: Testing
sidebar_position: 4.0
---

# Testing STC Pay

Moyasar offers a sandbox for STC Pay that allows you to test the service before going live.

## Test Mobile Numbers

STC Pay payment process is composed of two steps: **payment initiation** and **authentication**. During the initiation
process, error might occur resulting in a **failed** payment.

We provide a list of mobile numbers that can be used to simulate different results:

| Mobile Number | Payment Status | Message                                                                         |
| ------------- | -------------- | ------------------------------------------------------------------------------- |
| 0515555555    | failed         | Mobile number is not registered to use the STC Pay service.                     |
| 0515555556    | failed         | Please update your information using the STC Pay app before attempting payment. |
| 0515555557    | failed         | The customer account status is invalid, please contact STC Pay support.         |
| 0515555558    | failed         | You have exhausted your OTP attempts, please wait 15 minutes then try again.    |
| 0515555559    | failed         | Please wait 60 seconds before attempting a new payment.                         |
| Other         | initiated      | -                                                                               |

## OTP Result

Once the payment is initiated, you can simulate different results based on the OTP used.

| Mobile Number | Payment Status | Message                                                                         |
| ------------- | -------------- | ------------------------------------------------------------------------------- |
| 123456        | paid           | Paid                                                                            |
| 000000        | paid           | Paid                                                                            |
| 111111        | failed         | Insufficient Balance.                                                           |
| 222222        | failed         | You have exceeded the allowed daily transaction limit for your STC Pay account. |
| 333333        | failed         | You have exceeded the maximum allowed transaction amount.                       |
| 444444        | failed         | Connection timed out while waiting for response from STC Pay service.           |
| Other         | failed         | Invalid OTP                                                                     |
