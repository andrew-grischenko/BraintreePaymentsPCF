# BraintreePaymentsPCF

This is a simple Power App code component (PCF) that allows to facilitate credit card and PayPal payments in Power Apps via [Braintree payments](https://www.braintreepayments.com/). 

## Install and Use

Before you begin, create a [Braintree Sandbox account here](https://www.braintreepayments.com/au/sandbox) – it’s free for testing purposes. You will need it to facilitate the payments.

If you want to use PayPal as a payment option, you also need to set up a developer sandbox acount with PayPal and link it to Braintree account. Follow [these instructions](https://developers.braintreepayments.com/guides/paypal/testing-go-live/node#linked-paypal-testing) on how to do this.

### Import as a solution package

Download and import the managed solution package [**BraintreePayments_managed.zip**](https://github.com/andrew-grischenko/BraintreePaymentsPCF/blob/master/BraintreePCFSolution/package/BraintreePayments_managed.zip) or unmanaged package [**BraintreePayments_unmanaged.zip**](https://github.com/andrew-grischenko/BraintreePaymentsPCF/blob/master/BraintreePCFSolution/package/BraintreePayments_unmanaged.zip). As a result, you should get the solution **BraintreePayments** containing:
* Code PCF component **tema_Technomancy.BraintreePayments** hosting the [Drop-in UI](https://developers.braintreepayments.com/start/drop-in) from Braintree to capture credit card details and initate PayPal payment.
* Demo canvas Power App **BraintreePaymentsDemo** 

Skip the next section *"Build from the source"* if you just want to set up and use the solution. 

### Build from the source

Prerequisites: 
* NPM 
* Windows OS
* VS Code

1. Install Power Apps CLI and all its dependencies as described here: https://docs.microsoft.com/en-us/powerapps/developer/common-data-service/powerapps-cli 
2. Clone the repository https://github.com/andrew-grischenko/BraintreePaymentsPCF into a folder
3. Run the commands in the folder 

       npm install 

4. Follow the instruction here on how to

* build and test the component: https://docs.microsoft.com/en-us/powerapps/developer/component-framework/implementing-controls-using-typescript 
* package and deploy the component: https://docs.microsoft.com/en-us/powerapps/developer/component-framework/import-custom-controls 

### Setup the code component BraintreePayments and the app logic ###

1. Import a code component (PCF control):

* Select menu *Insert > Custom > Import component*
* Select the *"Code"* tab
* Select the **BraintreePayments** component and import it
* On the left panel find the component and add it to the screen

2. Set up the **TokenizationKey** attribute with the **Tokenization key** from your Braintree account. See more details in [Braintree documentation here](https://developers.braintreepayments.com/guides/authorization/overview). For the Sandbox environment it should start with "sandbox_"

3. Setup the visual appearance of the control (optional):

* **DefaultFontSize** – font size of messages and labels
* **CardFontSize** – font size of the card number capture element
* **ButtonFontSize** – font size for the Pay button

4. Set up the **PaymentAmount** with the payment amount (must be more than 0). 

5. Set the property **CheckoutURL** of the component with the URL of the Checkout function (see below the section **Setup Checkout Azure Function**)

6. Set the **PayPalEnabled** property to **true** if you want to use PayPal as a payment option.

7. Handle the payment events – success and errors – with **OnChange** handler of the component by verifying the PaymentStatus attribute, e.g.

       If(BraintreePayments.PaymentStatus = "completed", Navigate(Receipt)) 
       
![OnChange handler](https://technomancy.com.au/wp-content/uploads/2020/04/Screen-Shot-2020-04-24-at-10.22.46-pm.png)

7. For test integration, you can use:
* the card number **“4242424242424242”** or **411111111111111** with any future expiry date. See here for more test cards: https://developers.braintreepayments.com/guides/credit-cards/testing-go-live/node 
* PayPal Sandbox **personal** account as set up in the beggining

### Setup Checkout Azure Function

The integration with a payment gateway requires a secure server componet to communicate with the Braintree API. This solution implements this as an Azure Function - a simple Node.js function taking the payment "nonce" and a payment amount as parameters, initiating a ["sale" transaction](https://developers.braintreepayments.com/reference/request/transaction/sale/node) and returning the result. 

Please follow the installation instructions of the [Braintree Azure Function repository](https://github.com/andrew-grischenko/BraintreePaymentsAzureFunction) to setup th eserver component. 

Once this is done, use the URL of the function to set up the **CheckoutURL** of the component (see above).
