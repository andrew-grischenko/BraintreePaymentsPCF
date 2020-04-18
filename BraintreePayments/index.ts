import {IInputs, IOutputs} from "./generated/ManifestTypes";

const STATUS_UNINITIALISED: string = "uninitialised";
const STATUS_NEW: string 		= "new";
const STATUS_ERROR: string 		= "error";
const STATUS_PROCESSING: string = "processing";
const STATUS_COMPLETED: string 	= "completed";

export class BraintreePayments implements ComponentFramework.StandardControl<IInputs, IOutputs> {

	private payment_status: string;
	private _notifyOutputChanged: () => void;
	private tokenization_key: string;
	private payment_amount: number;
	private dropin_ui: any;
	private checkout_url: string;
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
		this._notifyOutputChanged = notifyOutputChanged;

		container.appendChild(this.getHTMLElements());

	}


	/**
	 * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
	 */
	public updateView(context: ComponentFramework.Context<IInputs>): void
	{
		if(this.tokenization_key != context.parameters.TokenizationKey.raw)
		{
			this.setStatus(STATUS_UNINITIALISED);
			if(this.dropin_ui)
				this.dropin_ui.teardown();

			this.tokenization_key = context.parameters.TokenizationKey.raw || "";

			if(this.tokenization_key)
				this.initBraintreeClient();
		}

		if(this.payment_amount != context.parameters.PaymentAmount.raw && context.parameters.PaymentAmount.raw)
			this.payment_amount = context.parameters.PaymentAmount.raw;

		if(this.checkout_url != context.parameters.CheckoutURL.raw && context.parameters.CheckoutURL.raw)
			this.checkout_url = context.parameters.CheckoutURL.raw;
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
		// Add code to cleanup control if necessary
	}

	private initBraintreeClient()
	{
		if(!this.tokenization_key)
			return;

		const dropin = require('braintree-web-drop-in');

		try {
			dropin.create({
				authorization: this.tokenization_key,
				container: '#dropin-container',
				card: {
					overrides: {
					  styles: {
						input: {
						  'font-size': '18pt'
						},
						'.number': {
						  // Custom web fonts are not supported. Only use system installed fonts.
						},
						'.invalid': {
						  color: 'red'
						}
					  }
					}
				  }
			},  (createErr: any, instance: any) => {
				if(instance){	
					this.dropin_ui = instance;	
					this.setStatus(STATUS_NEW);
					const submit_button = document.querySelector('#submit-button');
					submit_button!.addEventListener('click', () => {
						if(!this.checkout_url)
							throw("No Checkout URL has been specified");
						instance.requestPaymentMethod((err: any, payload: any) => {				
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
									instance.teardown();
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

				} else 
					this.errorInitBraintreeClient(createErr);
			});
		}
		catch (err) {
			this.errorInitBraintreeClient(err);
		}
	}

	private errorInitBraintreeClient(errorMessage: string)
	{
		this.setStatus(STATUS_ERROR);
		document.querySelector('#error-label')!.textContent = "There's been an error initialising Braintree: " + errorMessage + "\nAre you using correct TokenizationKey?";
	}

	private errorProcessing(errorMessage: string)
	{
		//this.setStatus(STATUS_ERROR);
		document.querySelector('#error-label')!.textContent = "There's been an error processing the payments: " + errorMessage;
	}

	private setStatus(status:string )
	{
		if(status != this.payment_status)
		{
			switch(status){
				case STATUS_UNINITIALISED:
					document.querySelector('#submit-button')?.classList.remove("hidden");
					document.querySelector('#submit-button')?.setAttribute("disabled", "true");
					document.querySelector('#error-label')!.textContent="The connection to Braintree has not been initialised. Make sure you've specified correct TokenizationKey property value.";
					document.querySelector('#error-div')?.classList.remove("hidden");
					document.querySelector('#dropin-container')?.classList.add("hidden");
					document.querySelector('#processing')?.classList.add("hidden");
					document.querySelector('#submit-button')?.classList.add("hidden");
					document.querySelector('#success')?.classList.add("hidden");
					break;
				case STATUS_NEW:
					document.querySelector('#submit-button')?.classList.remove("button-hidden");
					document.querySelector('#submit-button')?.removeAttribute("disabled");
					document.querySelector('#error-div')?.classList.add("hidden");
					document.querySelector('#dropin-container')?.classList.remove("hidden");
					document.querySelector('#processing')?.classList.add("hidden");
					document.querySelector('#submit-button')?.classList.remove("hidden");
					document.querySelector('#success')?.classList.add("hidden");
					break;
				case STATUS_PROCESSING:
					document.querySelector('#submit-button')?.classList.add("button-hidden");
					document.querySelector('#submit-button')?.setAttribute("disabled", "true");
					document.querySelector('#error-div')?.classList.add("hidden");
					document.querySelector('#dropin-container')?.classList.add("hidden");
					document.querySelector('#processing')?.classList.remove("hidden");
					document.querySelector('#submit-button')?.classList.add("hidden");
					document.querySelector('#success')?.classList.add("hidden");
					break;
				case STATUS_COMPLETED:
					document.querySelector('#submit-button')?.classList.add("button-hidden");
					document.querySelector('#submit-button')?.setAttribute("disabled", "true");
					document.querySelector('#error-div')?.classList.add("hidden");
					document.querySelector('#dropin-container')?.classList.add("hidden");
					document.querySelector('#processing')?.classList.add("hidden");
					document.querySelector('#submit-button')?.classList.add("hidden");
					document.querySelector('#success')?.classList.remove("hidden");
					break;
				case STATUS_ERROR:
					document.querySelector('#submit-button')?.classList.add("button-hidden");
					document.querySelector('#submit-button')?.setAttribute("disabled", "true");
					document.querySelector('#error-div')?.classList.remove("hidden");
					document.querySelector('#dropin-container')?.classList.add("hidden");
					document.querySelector('#processing')?.classList.add("hidden");
					document.querySelector('#submit-button')?.classList.add("hidden");
					document.querySelector('#success')?.classList.add("hidden");
					break;
			}
			this.payment_status = status;
			this._notifyOutputChanged();
		}
	}

	private getHTMLElements(): DocumentFragment 
	{
		let html = ` 
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
			<button id="submit-button" class="submit-buton">Pay</button>
			<div id="success" style="hidden">
				<div class="success-icon">
					<svg class="success-icon-tick">
						<path class="path1" d="M14.379 29.76L39.741 3.415 36.194.001l-21.815 22.79-10.86-11.17L0 15.064z"></path>
					</svg>				
				</div>
				<p>The payment has been successfull.</p>
			</div>`;
		var template = document.createElement('template');
		html = html.trim(); // Never return a text node of whitespace as the result
		template.innerHTML = html;
		return template.content;
	}
}