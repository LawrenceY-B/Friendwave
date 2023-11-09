"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSignedUrl = void 0;
const util_format_url_1 = require("@aws-sdk/util-format-url");
const middleware_endpoint_1 = require("@smithy/middleware-endpoint");
const protocol_http_1 = require("@smithy/protocol-http");
const presigner_1 = require("./presigner");
const getSignedUrl = async (client, command, options = {}) => {
    var _a, _b;
    let s3Presigner;
    if (typeof client.config.endpointProvider === "function") {
        const endpointV2 = await (0, middleware_endpoint_1.getEndpointFromInstructions)(command.input, command.constructor, client.config);
        const authScheme = (_b = (_a = endpointV2.properties) === null || _a === void 0 ? void 0 : _a.authSchemes) === null || _b === void 0 ? void 0 : _b[0];
        s3Presigner = new presigner_1.S3RequestPresigner({
            ...client.config,
            signingName: authScheme === null || authScheme === void 0 ? void 0 : authScheme.signingName,
            region: async () => authScheme === null || authScheme === void 0 ? void 0 : authScheme.signingRegion,
        });
    }
    else {
        s3Presigner = new presigner_1.S3RequestPresigner(client.config);
    }
    const presignInterceptMiddleware = (next, context) => async (args) => {
        var _a, _b;
        const { request } = args;
        if (!protocol_http_1.HttpRequest.isInstance(request)) {
            throw new Error("Request to be presigned is not an valid HTTP request.");
        }
        delete request.headers["amz-sdk-invocation-id"];
        delete request.headers["amz-sdk-request"];
        delete request.headers["x-amz-user-agent"];
        const presigned = await s3Presigner.presign(request, {
            ...options,
            signingRegion: (_a = options.signingRegion) !== null && _a !== void 0 ? _a : context["signing_region"],
            signingService: (_b = options.signingService) !== null && _b !== void 0 ? _b : context["signing_service"],
        });
        return {
            response: {},
            output: {
                $metadata: { httpStatusCode: 200 },
                presigned,
            },
        };
    };
    const middlewareName = "presignInterceptMiddleware";
    const clientStack = client.middlewareStack.clone();
    clientStack.addRelativeTo(presignInterceptMiddleware, {
        name: middlewareName,
        relation: "before",
        toMiddleware: "awsAuthMiddleware",
        override: true,
    });
    const handler = command.resolveMiddleware(clientStack, client.config, {});
    const { output } = await handler({ input: command.input });
    const { presigned } = output;
    return (0, util_format_url_1.formatUrl)(presigned);
};
exports.getSignedUrl = getSignedUrl;
