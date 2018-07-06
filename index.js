/*
This server breaks request handling into three stages:
    - pre-routing
    - routing
    - post-routing

Pre- and post-routing are groups of registered middleware that accept the
unified context object and return -- there is no `next()` semaphore.

This app explicitly exposes a registration method for routes.

This model will handle async/await functionality.

This model integrates cookie handling.
*/
const fs = require('fs');
const url = require('url');
const assert = require('assert');
const crypto = require('crypto');
const micro = require('micro');
const { createError, json } = require('micro');
const Cookies = require('cookies');


const contentHeaders = {
    html: { 'content-type': 'text/html' },
    css: { 'content-type': 'text/css' },
    javascript: { 'content-type': 'application/javascript' },
    json: { 'content-type': 'application/json' }
};


class AppServer {

    constructor(options) {
        this.options = options;
        this.routes = new Map();
        this.routeDefault = null;
        this.appChunks = {
            preRouting: [],
            postRouting: []
        };
        this.server = micro(this.appRouting.bind(this));
    }

    use(group, appChunk) {
        assert(this.appChunks.hasOwnProperty(group), `The application routing group ${group} has not been defined`);
        return this.appChunks[group].push(appChunk);
    }

    route(routePath, handler) {
        if (routePath === '*')
            return this.routeDefault = handler;
        this.routes.set(routePath, handler);
    }

    listen(port, cb) {
        Object.freeze(this.appChunks);
        Object.freeze(this.routes);
        return this.server.listen(port, cb);
    }

    static _encodeSessionToCookie(session) {
        if (session === null || typeof session === 'undefined')
            return '';
        return Buffer.from(JSON.stringify(session), 'utf8').toString('base64');
    }
    static _decodeSessionFromCookie(cookie) {
        if (cookie === null || typeof cookie === 'undefined')
            return {};
        return JSON.parse(Buffer.from(cookie, 'base64').toString('utf8'));
    }
    static _hashSession(session) {
        if (typeof session === 'object')
            session = JSON.stringify(session);
        return crypto.createHash('sha1').update(session).digest('hex');
    }

    async appRouting(req, res) {
        const cookies = new Cookies(req, res, this.options.cookies);
        const session = AppServer._decodeSessionFromCookie(cookies.get(this.options.cookie.name, this.options.cookie));
        const _sessionPreHash = AppServer._hashSession(session);

        const pUrl = url.parse(req.url);
        const ctx = {
            req, res, session, url: pUrl,
            _meta: {
                app: this,
                cookies,
                _sessionPreHash
            },
            getJSON() {
                return json(this.req);
            },            
            send(code, obj=null, header=null) {
                // update cookie if changed
                if (this._meta._sessionPreHash !== AppServer._hashSession(this.session))
                    this._meta.cookies.set(this._meta.app.options.cookie.name, AppServer._encodeSessionToCookie(this.session), this._meta.app.options.cookie);
                if (header)
                    ctx.res.setHeader(...Object.entries(header)[0]);
                return micro.send(ctx.res, code, obj);
            },
            sendFile(code, filepath, header) {
                return this.send(code, fs.createReadStream(filepath), header);
            },
            sendJSON(code, obj, ind=null) {
                if (!ind)
                    return this.send(code, JSON.stringify(obj), contentHeaders.json);
                return this.send(code, JSON.stringify(obj, null, ind), contentHeaders.json);
            },
            redirect(code, _path) {
                this.res.setHeader('location', _path);
                return this.send(303);
            },
            error: null
        };
        
        // pre-routing
        for (let appChunk of this.appChunks.preRouting) {
            await appChunk(ctx);
            if (ctx.res.headersSent) {  // if we've already started sending the response...
                if (!ctx.res.finished)
                    res.end();  // ...then end the response
                return;
            }
        }

        // routing
        const routeHandler = this.routes.get(pUrl.path);
        if (!routeHandler)
            if (this.routeDefault === null)
                throw createError(404, 'Not Found');
            else
                await this.routeDefault(ctx);
        else
            await routeHandler(ctx);

        // post routing
        for (let appChunk of this.appChunks.postRouting) {
            await appChunk(ctx);
            if (ctx.res.headersSent) {  // if we've already started sending the response...
                if (!ctx.res.finished)
                    res.end();  // ...then end the response
                return;
            }
        }

    }

}


module.exports = {
    AppServer,
    createError,
    contentHeaders
};