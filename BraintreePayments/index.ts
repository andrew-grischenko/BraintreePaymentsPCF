import {IInputs, IOutputs} from "./generated/ManifestTypes";

const STATUS_UNINITIALISED: string = "uninitialised";
const STATUS_NEW: string 		= "new";
const STATUS_ERROR: string 		= "error";
const STATUS_PROCESSING: string = "processing";
const STATUS_COMPLETED: string 	= "completed";

const DELAYED_INIT: number = 250; //ms

export class BraintreePayments implements ComponentFramework.StandardControl<IInputs, IOutputs> {

	private payment_status: string;
	private _notifyOutputChanged: () => void;
	private tokenization_key: string;
	private payment_amount: number;
	private dropin_ui: any;
	private checkout_url: string;
	private button_font_size: number;
	private card_font_size: number;
	private default_font_size: number;
	private delayed_init_handler: any;
	private has_been_reset: boolean;
	private paypal_enabled: boolean;
	//private error_font_size: number;
	/**
	 * Empty constructor.
	 */
	constructor()
	{

	}

	/**
	 * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
	 * Data-set values are not initialized here, use updateView.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
	 * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
	 * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
	 * @param container If a control is marked control-type='standard', it will receive an empty div element within which it can render its content.
	 */
	public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container:HTMLDivElement)
	{
		this.payment_status = STATUS_UNINITIALISED;
		this.has_been_reset = false;
		this._notifyOutputChanged = notifyOutputChanged;

		container.appendChild(this.getHTMLElements());

	}


	/**
	 * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
	 */
	public updateView(context: ComponentFramework.Context<IInputs>): void
	{
		enum BraintreeResetRequired {
			NO,
			YES_NEW,
			YES_UNINITIALISED
		};

		let isBraintreeResetRequired = BraintreeResetRequired.NO;

		if(this.tokenization_key != context.parameters.TokenizationKey.raw)
		{
			this.tokenization_key = context.parameters.TokenizationKey.raw || "";
			isBraintreeResetRequired = BraintreeResetRequired.YES_UNINITIALISED;
		}

		if(this.paypal_enabled != context.parameters.PayPalEnabled.raw){
			this.paypal_enabled = context.parameters.PayPalEnabled.raw;
			isBraintreeResetRequired = BraintreeResetRequired.YES_NEW;	
		}

		if(context.parameters.Reset.raw && !this.has_been_reset ){
			this.has_been_reset = true;
			isBraintreeResetRequired = BraintreeResetRequired.YES_NEW;	
		} else
			this.has_been_reset = false;

		if(this.payment_amount != context.parameters.PaymentAmount.raw && context.parameters.PaymentAmount.raw)
			this.payment_amount = context.parameters.PaymentAmount.raw;

		if(this.checkout_url != context.parameters.CheckoutURL.raw && context.parameters.CheckoutURL.raw)
			this.checkout_url = context.parameters.CheckoutURL.raw;

		if(this.default_font_size != context.parameters.DefaultFontSize.raw)
		{
			this.default_font_size = context.parameters.DefaultFontSize.raw || 18;
			document.documentElement.style.setProperty("--default-font-size", this.default_font_size + "pt"); 
			const smaller_font_size = this.default_font_size - ((this.default_font_size > 3) ? 3 : 0)
			document.documentElement.style.setProperty("--smaller-font-size", smaller_font_size + "pt"); 
		}

		if(this.card_font_size != context.parameters.CardFontSize.raw /*|| 
		   this.error_font_size != context.parameters.ErrorFontSize.raw*/)
		{
			this.card_font_size = context.parameters.CardFontSize.raw || 20;
			//this.error_font_size = context.parameters.ErrorFontSize.raw || 20;
			isBraintreeResetRequired = BraintreeResetRequired.YES_NEW;	
		}
		
		if(this.button_font_size != context.parameters.ButtonFontSize.raw)
		{
			this.button_font_size = context.parameters.ButtonFontSize.raw || 22;
			document.documentElement.style.setProperty("--button-font-size", this.button_font_size + "pt"); 
		}

		if(isBraintreeResetRequired != BraintreeResetRequired.NO){
			this.cleanupBraintreeClient(isBraintreeResetRequired == BraintreeResetRequired.YES_UNINITIALISED);
			this.initBraintreeClient();			
		}
	}

	/** 
	 * It is called by the framework prior to a control receiving new data. 
	 * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as “bound” or “output”
	 */
	public getOutputs(): IOutputs
	{
		return { PaymentStatus: this.payment_status };
	}

	/** 
	 * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
	 * i.e. cancelling any pending remote calls, removing listeners, etc.
	 */
	public destroy(): void
	{
		this.cleanupBraintreeClient(false);// Add code to cleanup control if necessary
	}

	private cleanupBraintreeClient(isThroughUnititialised: boolean)
	{
		if(this.dropin_ui)
			this.dropin_ui.teardown();
		this.dropin_ui = undefined;
		if(isThroughUnititialised)
			this.setStatus(STATUS_UNINITIALISED);
		document.querySelector('#submit-button')?.remove();
	}

	private initBraintreeClient()
	{
		if(!this.tokenization_key)
			return;

		if(this.delayed_init_handler)
			clearTimeout(this.delayed_init_handler);

		this.delayed_init_handler = setTimeout(() => {
			this.delayed_init_handler = undefined;

			const dropin = require('braintree-web-drop-in');

			const styles =  {
				input: {
					'font-size': this.card_font_size + 'pt'
				},
				'#card-sheet-header': {
					'font-size': this.card_font_size + 'pt'
				},
				'.number': {

				// Custom web fonts are not supported. Only use system installed fonts.
				},
				'.invalid': {
				color: 'red'/*,
				'font-size': this.error_font_size + 'pt'*/
				}
			};

			const options = (this.paypal_enabled) ? 
			{
				authorization: this.tokenization_key,
				container: '#dropin-container',
				card: {
					overrides: {
						styles: styles
						}
				},
				paypal: {
					flow: 'vault',
					buttonStyle: {
						color: 'blue',
						shape: 'rect',
						size: 'responsive',
						label: 'pay',
						tagline: 'false'
					  }
				}
			} :
			{
				authorization: this.tokenization_key,
				container: '#dropin-container',
				card: {
					overrides: {
						styles: styles
						}
				}
			};

			try {

				dropin.create(options,  (createErr: any, instance: any) => {
					if(instance){	
						this.dropin_ui = instance;	
						this.setStatus(STATUS_NEW);
						const submit_button = document.createElement("button");
						submit_button.setAttribute("id", "submit-button");
						submit_button.classList.add("submit-button");
						submit_button.textContent = "Pay";
						document.querySelector(".control-container")!.append(submit_button);
						this.setSubmitButtonState(false);

						submit_button!.addEventListener('click', ()=> { 
							if(!this.checkout_url)
								throw("No Checkout URL has been specified");

							this.dropin_ui.requestPaymentMethod((err: any, payload: any) => {				
							if(err || !payload){
								this.errorProcessing(err);
								return;
							}
							
							this.setStatus(STATUS_PROCESSING);

							console.log('NONCE=' + payload.nonce);
							fetch(this.checkout_url, {
								method: 'POST',
								headers : new Headers(),
								body:JSON.stringify({
									payment_method_nonce: payload.nonce,
									amount: this.payment_amount
								})
							})
							.then( (response:any) => {
								if ((response.status >= 200 && response.status <= 299) || response.status == 500 ) {
									return response.json();
								} else {
									throw Error(response.statusText);
								}
							})
							.then( (data: any ) => {
								if(data.success){
									this.setStatus(STATUS_COMPLETED);
									this.cleanupBraintreeClient(false);
								} else {
									this.setStatus(STATUS_ERROR);
									document.querySelector('#error-label')!.textContent = "There's been an error processing payment: " + data.message;
								}
							})
							.catch( (reason:any) => {
								// Handle the error
								this.setStatus(STATUS_ERROR);
								document.querySelector('#error-label')!.textContent = "There's been an error processing payment: " + reason;
							});
						});
						});

						const dropin_toggle = document.querySelector('[data-braintree-id="toggle"]');
						dropin_toggle!.addEventListener('click', () => {
							if (!instance.isPaymentMethodRequestable())
								this.setSubmitButtonState(false);
						});
						
						if(!this.paypal_enabled)
							this.setSubmitButtonState(true, false);
						
						instance.on('paymentOptionSelected', (event: any) => {
							if(event.paymentOption == 'card')
								this.setSubmitButtonState(this.payment_status != STATUS_PROCESSING, instance.isPaymentMethodRequestable());
							else
								this.setSubmitButtonState(false);
						});

						instance.on('paymentMethodRequestable', (event: any) => {
							this.setSubmitButtonState(this.payment_status != STATUS_PROCESSING, true);
						});
							
						instance.on('noPaymentMethodRequestable',  () => {
							if(instance.paymentOptionSelected == "card")
								this.setSubmitButtonState(true, false);
						});

					} else 
						this.errorInitBraintreeClient(createErr);
				});

				  
			}
			catch (err) {
				this.errorInitBraintreeClient(err);
			}
		}, DELAYED_INIT);

	}

	private errorInitBraintreeClient(errorMessage: string)
	{
		this.setStatus(STATUS_ERROR);
		document.querySelector('#error-label')!.textContent = "There's been an error initialising Braintree: " + errorMessage + "\nAre you using correct TokenizationKey?";
	}

	private errorProcessing(errorMessage: string)
	{
		this.setStatus(STATUS_ERROR);
		document.querySelector('#error-label')!.textContent = "There's been an error processing the payments: " + errorMessage;
	}

	private setStatus(status:string )
	{
		if(status != this.payment_status)
		{
			switch(status){
				case STATUS_UNINITIALISED:
					document.querySelector('#error-label')!.textContent="The connection to Braintree has not been initialised. Make sure you've specified correct TokenizationKey property value.";
					document.querySelector('#error-div')?.classList.remove("hidden");
					document.querySelector('#dropin-container')?.classList.add("hidden");
					document.querySelector('#processing')?.classList.add("hidden");
					document.querySelector('#success')?.classList.add("hidden");
					break;
				case STATUS_NEW:
					document.querySelector('#error-div')?.classList.add("hidden");
					document.querySelector('#dropin-container')?.classList.remove("hidden");
					document.querySelector('#processing')?.classList.add("hidden");
					document.querySelector('#success')?.classList.add("hidden");
					break;
				case STATUS_PROCESSING:
					document.querySelector('#error-div')?.classList.add("hidden");
					document.querySelector('#dropin-container')?.classList.add("hidden");
					document.querySelector('#processing')?.classList.remove("hidden");
					document.querySelector('#success')?.classList.add("hidden");
					break;
				case STATUS_COMPLETED:
					document.querySelector('#error-div')?.classList.add("hidden");
					document.querySelector('#dropin-container')?.classList.add("hidden");
					document.querySelector('#processing')?.classList.add("hidden");
					document.querySelector('#success')?.classList.remove("hidden");
					break;
				case STATUS_ERROR:
					document.querySelector('#error-div')?.classList.remove("hidden");
					document.querySelector('#dropin-container')?.classList.add("hidden");
					document.querySelector('#processing')?.classList.add("hidden");
					document.querySelector('#success')?.classList.add("hidden");
					break;
			}

			this.setSubmitButtonState(false);
			this.payment_status = status;
			this._notifyOutputChanged();
		}
	}

	private setSubmitButtonState(isVisible: boolean, isEnabled: boolean = false){
		const submitButton = document.querySelector('#submit-button');

		if(!submitButton)
			return;

		if(isVisible)
			submitButton.classList.remove("hidden");
		else
			submitButton.classList.add("hidden");

		if(isEnabled)
			submitButton.removeAttribute("disabled");
		else
			submitButton.setAttribute("disabled", "true");
	}

	private getHTMLElements(): DocumentFragment 
	{
		let html = ` 
			<div class="control-container">
				<div class="error hidden" id="error-div">
					<span id="error-label">The connection to Braintree has not been initialised. Make sure you've specified correct TokenizationKey property value.</span>
				</div>
				<div id="dropin-container"></div>
				<div id="processing" class="hidden">
					<div class="processing">
						<svg width="14" height="16" class="processing-lock">
							<use xlink:href="#iconLockLoader"></use>
						</svg>
					</div>
					<p>Processing...</p>
				</div>
				<div id="success" class="hidden">
					<div class="success-icon">
						<svg class="success-icon-tick">
							<path class="path1" d="M14.379 29.76L39.741 3.415 36.194.001l-21.815 22.79-10.86-11.17L0 15.064z"></path>
						</svg>				
					</div>
					<p>The payment has been successfull.</p>
				</div>
			</div>`;
		var template = document.createElement('template');
		html = html.trim(); // Never return a text node of whitespace as the result
		template.innerHTML = html;
		return template.content;
	}
}