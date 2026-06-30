export namespace main {
	
	export class AuthResult {
	    profileId: string;
	    serverUrl: string;
	    serverName: string;
	    displayName: string;
	    email: string;
	    accessToken: string;
	    refreshToken: string;
	
	    static createFrom(source: any = {}) {
	        return new AuthResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.profileId = source["profileId"];
	        this.serverUrl = source["serverUrl"];
	        this.serverName = source["serverName"];
	        this.displayName = source["displayName"];
	        this.email = source["email"];
	        this.accessToken = source["accessToken"];
	        this.refreshToken = source["refreshToken"];
	    }
	}
	export class HTTPCookie {
	    name: string;
	    value: string;
	    domain: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new HTTPCookie(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.value = source["value"];
	        this.domain = source["domain"];
	        this.path = source["path"];
	    }
	}
	export class HTTPRequest {
	    method: string;
	    url: string;
	    headers: Record<string, string>;
	    body: string;
	    bodyIsBase64: boolean;
	
	    static createFrom(source: any = {}) {
	        return new HTTPRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.method = source["method"];
	        this.url = source["url"];
	        this.headers = source["headers"];
	        this.body = source["body"];
	        this.bodyIsBase64 = source["bodyIsBase64"];
	    }
	}
	export class HTTPResponse {
	    statusCode: number;
	    status: string;
	    headers: Record<string, string>;
	    cookies: HTTPCookie[];
	    body: string;
	    durationMs: number;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new HTTPResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.statusCode = source["statusCode"];
	        this.status = source["status"];
	        this.headers = source["headers"];
	        this.cookies = this.convertValues(source["cookies"], HTTPCookie);
	        this.body = source["body"];
	        this.durationMs = source["durationMs"];
	        this.error = source["error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class InviteInfo {
	    email: string;
	    displayName: string;
	
	    static createFrom(source: any = {}) {
	        return new InviteInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.email = source["email"];
	        this.displayName = source["displayName"];
	    }
	}
	export class PendingInvite {
	    serverUrl: string;
	    token: string;
	    email: string;
	
	    static createFrom(source: any = {}) {
	        return new PendingInvite(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.serverUrl = source["serverUrl"];
	        this.token = source["token"];
	        this.email = source["email"];
	    }
	}
	export class Settings {
	    language: string;
	    myProfileName: string;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.language = source["language"];
	        this.myProfileName = source["myProfileName"];
	    }
	}

}

