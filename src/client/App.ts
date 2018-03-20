class App
{
	constructor()
	{
		
	}

	public init( errorLegacy: ()=> void, noLegacy: () => void )
	{
		return this.initServiceWorker( errorLegacy, noLegacy );
	}

	public isModernBrowser()
	{
		// Dialog check.
		const dialog = <HTMLDialogElement>document.createElement( 'dialog' );
		if ( typeof dialog.showModal !== 'function' || typeof dialog.close !== 'function' ) { return false; }

		return true;
	}

	// ServiceWorker

	private updateServiceWorker( registration: ServiceWorkerRegistration )
	{
		console.log( 'UpdateServiceWorker' );
		return registration.update().then( () =>
		{
			if ( navigator.serviceWorker.controller ) { return Promise.resolve( {} ); }
			console.log( 'Reload!!!!' );
			location.reload();
			throw 'ServiceWorker update.';
		} );
	}

	private initServiceWorker( errorLegacy: ()=> void, noLegacy: () => void )
	{
		// Error ... Use old browser.
		const errtimer = setTimeout( () => { errorLegacy(); }, 500 );
		if ( !( 'serviceWorker' in navigator ) ) { throw 'ServiceWorker notfound.'; }
		if ( !this.isModernBrowser() ){ throw 'This browser is legacy.'; }
		// Stop error.
		clearTimeout( errtimer );
		noLegacy();

		navigator.serviceWorker.register( './sw.js'/*, {scope: '/example'}*/ );
		//navigator.serviceWorker.getRegistration()
		return navigator.serviceWorker.ready.then( ( registration ) =>
		{
			if ( !registration.active ) { throw 'ServiceWorker not active.'; }
			registration.addEventListener( 'updatefound', ( event ) =>
			{
				// 更新があった
				console.log( 'updatefound', event );
			} );

			(<HTMLButtonElement>document.getElementById( 'updsw' )).addEventListener( 'click', ( event ) =>
			{
				// Force Update ServiceWorker
				this.updateServiceWorker( registration );
			}, false );

			// Force Update ServiceWorker
			return this.updateServiceWorker( registration );
		} ).catch( ( error ) => { console.log( error ); } );
	}

	// Dialog

	public setDialog( basename: string )
	{
		const button = <HTMLButtonElement>document.getElementById( 'edit_' + basename );
		const dialog = <HTMLDialogElement>document.getElementById( 'dialog_' + basename );
		if ( !button || !dialog ) { return null; }

		// Add close button.
		const close = document.createElement( 'button' );
		close.addEventListener( 'click', () => { dialog.close(); }, false );
		dialog.appendChild( close );

		// Option: Add cancel button.
		const cancel = document.getElementById( 'cancel_' + basename );
		if ( cancel )
		{
			cancel.addEventListener( 'click', () => { dialog.close(); }, false );
		}

		button.addEventListener( 'click', () =>
		{
			dialog.showModal();
		}, false );

		return dialog;
	}

	// Edit

	public initEdit()
	{
		this.initEditUserData();
	}

	private initEditUserData()
	{
		const dialog = this.setDialog( 'userdata' );

	}

	// Theme

	public getTheme()
	{
		const theme: THEME =
		{
			backColor: '',
			backColorAlpha: '',
		};

		Object.keys( theme ).forEach( ( key: keyof THEME ) =>
		{
			theme[ key ] = document.documentElement.style.getPropertyValue( '--' + key );
		} );

		return theme;
	}

	public setTheme( theme: THEME )
	{
		Object.keys( theme ).forEach( ( key: keyof THEME ) =>
		{
			document.documentElement.style.setProperty( '--' + key, theme[ key ] );
		} );
	}
}
