"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3RequestPresigner = void 0;
const signature_v4_multi_region_1 = require("@aws-sdk/signature-v4-multi-region");
const constants_1 = require("./constants");
class S3RequestPresigner {
    constructor(options) {
        const resolvedOptions = {
            service: options.signingName || options.service || "s3",
            uriEscapePath: options.uriEscapePath || false,
            applyChecksum: options.applyChecksum || false,
            ...options,
        };
        this.signer = new signature_v4_multi_region_1.SignatureV4MultiRegion(resolvedOptions);
    }
    presign(requestToSign, { unsignableHeaders = new Set(), unhoistableHeaders = new Set(), ...options } = {}) {
        unsignableHeaders.add("content-type");
        Object.keys(requestToSign.headers)
            .map((header) => header.toLowerCase())
            .filter((header) => header.startsWith("x-amz-server-side-encryption"))
            .forEach((header) => {
            unhoistableHeaders.add(header);
        });
        requestToSign.headers[constants_1.SHA256_HEADER] = constants_1.UNSIGNED_PAYLOAD;
        const currentHostHeader = requestToSign.headers.host;
        const port = requestToSign.port;
        const expectedHostHeader = `${requestToSign.hostname}${requestToSign.port != null ? ":" + port : ""}`;
        if (!currentHostHeader || (currentHostHeader === requestToSign.hostname && requestToSign.port != null)) {
            requestToSign.headers.host = expectedHostHeader;
        }
        return this.signer.presign(requestToSign, {
            expiresIn: 900,
            unsignableHeaders,
            unhoistableHeaders,
            ...options,
        });
    }
}
exports.S3RequestPresigner = S3RequestPresigner;
