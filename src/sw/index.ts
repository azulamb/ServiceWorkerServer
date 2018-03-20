/// <reference path="../types.d.ts" />

interface ResponseCallback{ ( event: FetchEvent, url: URL, reg: RegExpExecArray ): Promise<Response> }

const NO_IMAGE = 'noimage.png';
const DOMAIN = 'mylocal-';
const CACHE_VERSION = 'static_v0.0.0';
const DB_NAME = 'swsdb';
const DB_VERSION = 1;
const CACHE_ON = false;
const HTTP_STATUS_TEXT: { [ key: number ]: string } =
{
	200: 'OK',
	201: 'Created',
	202: 'Accepted',
	203: 'Non-Authoritative Information',
	204: 'No Content',
	205: 'Reset Content',
	206: 'Partial Content',
	207: 'Multi-Status',
	208: 'Already Reported',
	226: 'IM Used',
	300: 'Multiple Choices',
	301: 'Moved Permanently',
	302: 'Found',
	303: 'See Other',
	304: 'Not Modified',
	305: 'Use Proxy',
	306: '',
	307: 'Temporary Redirect',
	308: 'Permanent Redirect',
	400: 'Bad Request',
	401: 'Unauthorized',
	402: 'Payment Required',
	403: 'Forbidden',
	404: 'Not Found',
	405: 'Method Not Allowed',
	406: 'Not Acceptable',
	407: 'Proxy Authentication Required',
	408: 'Request Timeout',
	409: 'Conflict',
	410: 'Gone',
	411: 'Length Required',
	412: 'Precondition Failed',
	413: 'Payload Too Large',
	414: 'URI Too Long',
	415: 'Unsupported Media Type',
	416: 'Range Not Satisfiable',
	417: 'Expectation Failed',
	418: "I'm a teapot",
	421: 'Misdirected Request',
	422: 'Unprocessable Entity',
	423: 'Locked',
	424: 'Failed Dependency',
	426: 'Upgrade Required',
	451: 'Unavailable For Legal Reasons',
	500: 'Internal Server Error',
	501: 'Not Implemented',
	502: 'Bad Gateway',
	503: 'Service Unavailable',
	504: 'Gateway Timeout',
	505: 'HTTP Version Not Supported',
	506: 'Variant Also Negotiates',
	507: 'Insufficient Storage',
	508: 'Loop Detected',
	509: 'Bandwidth Limit Exceeded',
	510: 'Not Extended',
};

type TypedArray = Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Uint8ClampedArray | Float32Array | Float64Array;

class LocalServer
{
	private route: { cb: ResponseCallback, reg: RegExp }[];
	private prepare: boolean;

	constructor()
	{
		this.prepare = false;
		this.route = [];
	}

	public setPrepare( complete: boolean ) { this.prepare = complete; }

	public isPrepared() { return this.prepare; }

	public addRoute( reg: RegExp, cb: ResponseCallback )
	{
		this.route.push( { cb: cb, reg: reg } );
	}

	public routing( event: FetchEvent )
	{
		const url = new URL( event.request.url );

		for( let i = 0 ; i < this.route.length ; ++i )
		{
			let result = this.route[ i ].reg.exec( url.pathname );
			if ( !result ) { continue; }
			return this.route[ i ].cb( event, url, result );
		}

		return this.fetchServer( url, event );
	}

	/**
	@param data Binary data.
	@param headers Headers or ContentType(string).
	*/
	public responseBinary( data: ArrayBuffer | TypedArray, headers?: Headers | string )
	{
		if ( !headers || typeof headers === 'string' )
		{
			const contentType = headers;
			headers = new Headers();
			if ( contentType ) { headers.append( 'Content-Type', contentType ); }
		}
		if ( !headers.has( 'Content-Length' ) ) { headers.append( 'Content-Length', data.byteLength + '' ); }

		const init: ResponseInit =
		{
			status: 200,
			statusText: 'OK',
			headers: headers,
		};

		return new Response( data, init );
	}

	public responseJSON( data: any, headers?: Headers )
	{
		const jsonstr = JSON.stringify( data );

		if ( !headers ) { headers = new Headers(); }
		if ( !headers.has( 'Content-Type' ) ) { headers.append( 'Content-Type', 'application/json' ); }
		if ( !headers.has( 'Content-Length' ) ) { headers.append( 'Content-Length', encodeURI( jsonstr ).replace( /%../g, '*' ).length + '' ); }

		const init: ResponseInit =
		{
			status: 200,
			statusText: 'OK',
			headers: headers,
		};

		return new Response( jsonstr, init );
	}

	public responseError( data: any, code: number = 400, headers?: Headers )
	{
		const jsonstr = JSON.stringify( data );

		if ( !headers ) { headers = new Headers(); }
		if ( !headers.has( 'Content-Type' ) ) { headers.append( 'Content-Type', 'application/json' ); }
		if ( !headers.has( 'Content-Length' ) ) { headers.append( 'Content-Length', encodeURI( jsonstr ).replace( /%../g, '*' ).length + '' ); }

		const init: ResponseInit =
		{
			status: code,
			statusText: HTTP_STATUS_TEXT[ code ] || 'Unknown',
			headers: headers,
		};

		return new Response( jsonstr, init );
	}

	public defaultResponse( p: Promise<any> )
	{
		return p.then( () =>
		{
			return this.responseJSON( <API_RESULT>{ message: 'OK.' } );
		} ).catch( ( error ) =>
		{
console.log(error);
			return this.responseError( typeof error === 'string' ? { message: error } : error );
		} );
	}

	private fetchServer( url: URL, event: FetchEvent )
	{
		// TODO: Cache
		//const cacheRequest = event.request.clone();
		//{ cache: 'no-cache', mode: 'no-cors' }
		return fetch( event.request ).then( ( response ) =>
		{
			// Error
			if ( !response.ok ) { throw response; }

			this.addCache( url, event.request, response );

			return response;
		} ).catch( ( error ) =>
		{
			// Server error => Search cache.
			return this.cacheResponse( url.href ).catch( ( error_cache ) =>
			{
				// No cache.

				// Not image => error.
				if ( !url.pathname.match( /\.png$/ ) ) { throw error; }

				// Image => change default no image.
				return this.cacheResponse( NO_IMAGE, error );
			} );
		} );
	}

	private getCache( url_str: string )
	{
		return caches.match( url_str, { cacheName: DOMAIN + CACHE_VERSION } );
	}

	private openCache() { return caches.open( DOMAIN + CACHE_VERSION ); }

	private addCache( url: URL, request: Request, response: Response )
	{
		if ( !CACHE_ON ) { return; }
		// Success => Update cache.
		const cacheRequest = request.clone();
		const cacheResponse = response.clone();
		this.getCache( url.href ).then( ( response ) =>
		{
			if ( !response ) { return; }
			// Update.
			this.openCache().then( ( cache ) =>
			{
				cache.put( cacheRequest, cacheResponse );
			} );
		} );
	}

	private cacheResponse( url_str: string, error?: any )
	{
		return this.getCache( url_str ).catch( ( error_cache ) =>
		{
			if ( error === undefined ) { error = error_cache; }
			throw error;
		} );
	}
}

class Support
{
	public static b64table: Uint8Array;

	public static init()
	{
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
		const table = new Uint8Array( 256 );
		for ( let i = 0; i < chars.length; ++i )
		{
			table[ chars.charCodeAt( i ) ] = i;
		}
		Support.b64table = table;
	}

	public static base64ToArray( base64: string )
	{
		const length = Math.floor( base64.length * 0.75 ) - ( ( base64[ base64.length - 1 ] === "=" ) ? ( ( base64[base64.length - 2 ] === "=" ) ? 2 : 1 ) : 0 );

		const bytes = new Uint8Array( new ArrayBuffer( length ) );

		let p = 0;
		for ( let i = 0 ; i < base64.length ; i += 4 )
		{
			const a = Support.b64table[ base64.charCodeAt( i ) ];
			const b = Support.b64table[ base64.charCodeAt( i + 1 ) ];
			const c = Support.b64table[ base64.charCodeAt( i + 2 ) ];
			const d = Support.b64table[ base64.charCodeAt( i + 3 ) ];

			bytes[ p++ ] = ( a << 2 ) | ( b >> 4 );
			bytes[ p++ ] = ( ( b & 15 ) << 4 ) | ( c >> 2 );
			bytes[ p++ ] = ( ( c & 3 ) << 6 ) | ( d & 63 );
		}

		return bytes;
	}
}

class RDB
{
	private dbname: string;
	private db: IDBDatabase;

	constructor( dbname: string )
	{
		this.dbname = dbname;
	}

	public open( version: number )
	{
		return new Promise( ( resolve, reject ) =>
		{
			const openReq = indexedDB.open( this.dbname, version );

			openReq.onupgradeneeded = ( event ) =>
			{
				console.log('DB upgrade');
				this.db = (<any>event.target).result;

				this.db.onerror = ( event ) => { console.log( 'DB Error:', event ); }

				this.createTable( 'userdata', 'key', [ { name: 'val' } ] );
			}

			openReq.onsuccess = ( event ) =>
			{
				console.log('DB open success');
				this.db = openReq.result;
				//db.close();
				resolve();
			}

			openReq.onerror = ( event ) => { reject( event ); }
		} );
	}

	private createTable( tableName: string, keyPath: string, table: { name: string, unique?: boolean }[] )
	{
		const store = this.db.createObjectStore( tableName, { keyPath: keyPath } );
		store.transaction.oncomplete = () => {};

		table.forEach( ( column ) =>
		{
			store.createIndex( column.name, column.name, { unique: !!column.unique } );
		} );
	}

	private add( tableName: string, data: { key: string, val: any }[] )
	{
		return new Promise( ( resolve, reject ) =>
		{
			const transaction = this.db.transaction( tableName, 'readwrite' );
			transaction.oncomplete = ( event ) => { resolve(); };
			transaction.onerror = ( event ) => { reject( event ); };
			const store = transaction.objectStore( tableName );
			for ( const item in data )
			{
				store.add( item );
			}
		} );
	}

	private set( tableName: string, key: string, data: { key: string, val: any } )
	{
		return new Promise( ( resolve, reject ) =>
		{
			const transaction = this.db.transaction( tableName, 'readwrite' );
			transaction.oncomplete = ( event ) => { resolve(); };
			transaction.onerror = ( event ) => { reject( event ); };
			const objectStore = transaction.objectStore( tableName )
			//.add( data, key );
			const request = objectStore.openCursor( key );
			request.onsuccess = ( event ) =>
			{
				//const cursor = event.target.target;
				const cursor: IDBCursor = (<any>event.target).result;
				if ( cursor )
				{
					cursor.update( data );
				} else
				{
					objectStore.add( data );
				}
			};
		} );
	}

	private del( tableName: string, key: string )
	{
		return new Promise( ( resolve, reject ) =>
		{
			const transaction = this.db.transaction( tableName, 'readwrite' );
			transaction.onerror = ( event ) => { reject( event ); };
			const request = transaction.objectStore( tableName ).delete( key );
			request.onsuccess = () => { resolve( request.result ); };
			//request.onerror = ( event ) => { reject( event ); };
		} );
	}


	private get( tableName: string, key: string )
	{
		return new Promise( ( resolve, reject ) =>
		{
			const transaction = this.db.transaction( tableName, 'readonly' );
			transaction.onerror = ( event ) => { reject( event ); };
			const request = transaction.objectStore( tableName ).get( key );
			request.onsuccess = () => { resolve( request.result ); };
		} );
	}

	public setUserData( key: string, value: string )
	{
		return this.set( 'userdata', key, { key: key, val: value } );
	}

	public getUserData( key: string )
	{
		return this.get( 'userdata', key );
	}

	public getAllUserData(): Promise<USER_DATA>
	{
		return new Promise( ( resolve, reject ) =>
		{
			const store = this.db.transaction( 'userdata', 'readonly' ).objectStore( 'userdata' );

			const request = store.openCursor();
			const data: USER_DATA = { name: '' };
			request.onsuccess = ( event ) =>
			{
				const cursor: IDBCursor = (<any>event.target).result;
				if ( !cursor ) { return resolve( data ); }
console.log(cursor);
				const item: { key: string, val: string } = (<any>cursor).value;
				if ( typeof item.key === 'string' ) { (<any>data)[ item.key ] = item.val; }
				cursor.continue();
			};
			request.onerror = ( event ) => { reject( event ); }
		} );
	}

	public leave()
	{
		return this.del( 'userdata', 'name' );
	}
}

function InitServer()
{
	console.log( 'Init server' );
	Support.init();
	if ( server.isPrepared() ) { return Promise.resolve(); }

	const db = new RDB( DB_NAME );

	// User API.
	server.addRoute( /^\/api\/user\/(.*)$/, ( event, url, reg ) =>
	{
		switch ( reg[ 1 ] )
		{
			case 'get':
				//return Promise.resolve( server.responseJSON( <USER_DATA>{ name: '', } ) );
				return db.getAllUserData().then( ( data ) => { return server.responseJSON( data ); } );
			case 'set':
				return event.request.json().then( ( data ) =>
				{
					if ( !data || typeof data.name !== 'string' )
					{
						throw "Require: name";
					}
					return server.defaultResponse( db.setUserData( 'name', <string>data.name ) );
				} ).catch( ( error ) =>
				{
					return server.responseError( typeof error === 'string' ? { message: error } : error );
				} );
			case 'leave':
				return server.defaultResponse( db.leave() );
		}
		return Promise.resolve( server.responseJSON( <USER_DATA>{ name: '', } ) );
	} );
	// Other API.
	server.addRoute( /^\/api\/*/, ( event, url, reg ) =>
	{
		return Promise.resolve( server.responseJSON( { message: 'API not found.' } ) );
	} );

	server.setPrepare( true );

	return db.open( DB_VERSION );
}


////////////////////////////////////////
//           ServiceWorker            //
////////////////////////////////////////

const server: LocalServer = new LocalServer();
const sw: ServiceWorkerGlobalScope = (<any>self);

sw.addEventListener( 'install', ( event ) =>
{
	console.log('install');
	// TODO: create cache noimage.
	const p: Promise<any>[] = [ InitServer(), sw.skipWaiting() ];
	event.waitUntil( Promise.all( p ) );
	//caches.open( CACHE_VERSION ).then( ( cache ) => { return cache.add('/horse.svg'); } )
} );

sw.addEventListener( 'activate', ( event ) =>
{
	console.log( 'activate' );
	//event.waitUntil( sw.clients.claim() );
	event.waitUntil( caches.keys().then( ( keys ) =>
	{
		const cache_name = DOMAIN + CACHE_VERSION;
		return Promise.all(
			keys.filter( ( key ) => { return key.indexOf( DOMAIN ) === 0 && cache_name !== key; } ).map( ( key ) =>
			{
				console.log( 'Delete cache:', key );
				return caches.delete( key );
			} )
		);
	} ).then( () =>
	{
		return sw.clients.claim();
	} ) );
} );

sw.addEventListener( 'fetch', ( event ) =>
{
console.log('fetch',event.request.url);
	event.respondWith( server.routing( event ) );
} );
