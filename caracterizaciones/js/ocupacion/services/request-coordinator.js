export class RequestCoordinator {
    constructor() {
        this.requests = new Map();
    }

    start(scope) {
        this.abort(scope);

        const controller = new AbortController();
        const token = {
            scope,
            id: Symbol(scope),
            signal: controller.signal,
            controller
        };

        this.requests.set(scope, token);
        return token;
    }

    isCurrent(token) {
        return Boolean(token && this.requests.get(token.scope)?.id === token.id && !token.signal.aborted);
    }

    abort(scope) {
        const current = this.requests.get(scope);
        if (current && !current.signal.aborted) {
            current.controller.abort();
        }
        this.requests.delete(scope);
    }
}
