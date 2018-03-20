/// <reference path="../types.d.ts" />

function ConvertDefaultResult( data: any ) { return <API_RESULT>data; }

const API =
{
	get: ( api: string, req?: RequestInit ) =>
	{
		return fetch( '/api/' + api, req ).then( ( response ) => { return response.json(); } );
	},
	post: ( api: string, data?: any, req?: RequestInit ) =>
	{
		if ( !req ) { req = {}; }
		req.method = 'POST';
		if ( data !== undefined )
		{
			req.body = JSON.stringify( data );
		}
		return API.get( api, req );
	},
	user:
	{
		registration: ( name: string ) => { return API.user.set( name ); },
		get: () => { return API.get( 'user/get' ).then( ( data ) => { return <USER_DATA>data; } ); },
		set: ( name: string ) => { return API.post( 'user/set', { name: name } ).then( ConvertDefaultResult ); },
		leave: () => { return API.get( 'user/leave' ); }
	},
};
