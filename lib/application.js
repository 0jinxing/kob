'use strict';
const http = require('http');
const util = require('util');
const Events = require('events');

module.exports = class Application extends Events {
    constructor() {
        super();
        this.middleware = [];
        this.context = {};
        this.request = {};
        this.response = {};
    }

    listen(...args) {
        const server = http.createServer(this.callback());
        return server.listen(...args);
    }

    use(fn) {
        if (typeof fn !== 'function') throw new TypeError('middleware must be a function!');
        this.middleware.push(fn);
    }

    callback() {
        const fn = this.compose();
        const handleRequest = (req, res) => {
            const ctx = this.createContext(req, res);
            return this.handleRequest(ctx, fn)
        }
        return handleRequest;
    }

    handleRequest(ctx, fnMiddleware) {
        const res = ctx.res;
        res.statusCode = 200;
        const handleResponse = () => res.end(ctx.body);
        return fnMiddleware(ctx).then(handleResponse).catch(this.onerror.bind(this));
    }

    createContext(req, res) {
        const context = Object.create(this.context);
        context.app = this;
        context.request = Object.create(this.request);
        context.response = Object.create(this.response);
        context.req = req;
        context.res = res;
        return context;
    }

    onerror(err) {
        if (!(err instanceof Error)) throw new TypeError(util.format('non-error thrown: %j', err));
        if (404 == err.status || err.exports) return;
        if (err.silent) return;
        this.emit('error', err);
    }

    compose() {
        return async ctx => {
            function createNext(middleware, oldNext) {
                return async () => await middleware(ctx, oldNext);
            }
            const len = this.middleware.length;
            let next = async () => Promise.resolve();
            for (let i = len - 1; i >= 0; i--) {
                const currentMiddleware = this.middleware[i];
                next = createNext(currentMiddleware, next);
            }
            await next();
        };
    }
};