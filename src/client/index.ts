document.addEventListener( 'DOMContentLoaded', () =>
{
	const app = new App();

	app.init( () =>
	{
		// Old browser. (Cannot use ServiceWorker, Dialog, etc ...)
		(<HTMLElement>document.getElementById( 'legacy' )).classList.add( 'view' );
	}, () =>
	{
		// Modern browser.
		app.initEdit();
		(<HTMLElement>document.getElementById( 'legacy' )).classList.add( 'hide' );
	} ).then( () =>
	{
		API.user.get().then( ( data ) =>
		{
			if ( !data.name )
			{
				// Not exists user.
				(<HTMLButtonElement>document.getElementById( 'post_registration' )).addEventListener( 'click', () =>
				{
					const value = (<HTMLInputElement>document.getElementById( 'login_name' )).value;
					API.user.registration( value ).then( ( result ) =>
					{
						// Login OK.
						location.reload();
					} ).catch( ( error ) =>
					{
console.log(error);
					} );
				}, false );
				return;
			}
			// Exists user.

			// Get default theme.
			const theme = app.getTheme();

			// Print name.
			(<HTMLElement>document.getElementById( 'name' )).textContent = data.name;

			// Leave
			(<HTMLButtonElement>document.getElementById( 'post_leave' )).addEventListener( 'click', () =>
			{
				API.user.leave().then( () =>
				{
					location.reload();
				} );
			}, false );

			// Login.
			document.body.classList.add( 'logined' );

		} );
	} ).catch( ( error ) =>
	{
		console.log( error );
	} );
} );
