import { PutObjectCommand } from "@aws-sdk/client-s3";
import { formatUrl } from "@aws-sdk/util-format-url";
import { getEndpointFromInstructions, toEndpointV1, } from "@smithy/middleware-endpoint";
import { createScope, getSigningKey } from "@smithy/signature-v4";
import { toHex } from "@smithy/util-hex-encoding";
import { toUint8Array } from "@smithy/util-utf8";
import { ALGORITHM_IDENTIFIER, ALGORITHM_QUERY_PARAM, AMZ_DATE_QUERY_PARAM, CREDENTIAL_QUERY_PARAM, SIGNATURE_QUERY_PARAM, TOKEN_QUERY_PARAM, } from "./constants";
export const createPresignedPost = async (client, { Bucket, Key, Conditions = [], Fields = {}, Expires = 3600 }) => {
    const { systemClockOffset, base64Encoder, utf8Decoder, sha256 } = client.config;
    const now = new Date(Date.now() + systemClockOffset);
    const signingDate = iso8601(now).replace(/[\-:]/g, "");
    const shortDate = signingDate.slice(0, 8);
    const clientRegion = await client.config.region();
    const credentialScope = createScope(shortDate, clientRegion, "s3");
    const clientCredentials = await client.config.credentials();
    const credential = `${clientCredentials.accessKeyId}/${credentialScope}`;
    const fields = {
        ...Fields,
        bucket: Bucket,
        [ALGORITHM_QUERY_PARAM]: ALGORITHM_IDENTIFIER,
        [CREDENTIAL_QUERY_PARAM]: credential,
        [AMZ_DATE_QUERY_PARAM]: signingDate,
        ...(clientCredentials.sessionToken ? { [TOKEN_QUERY_PARAM]: clientCredentials.sessionToken } : {}),
    };
    const expiration = new Date(now.valueOf() + Expires * 1000);
    const conditionsSet = new Set();
    for (const condition of Conditions) {
        const stringifiedCondition = JSON.stringify(condition);
        conditionsSet.add(stringifiedCondition);
    }
    for (const [k, v] of Object.entries(fields)) {
        conditionsSet.add(JSON.stringify({ [k]: v }));
    }
    if (Key.endsWith("${filename}")) {
        conditionsSet.add(JSON.stringify(["starts-with", "$key", Key.substring(0, Key.lastIndexOf("${filename}"))]));
    }
    else {
        conditionsSet.add(JSON.stringify({ key: Key }));
    }
    const conditions = Array.from(conditionsSet).map((item) => JSON.parse(item));
    const encodedPolicy = base64Encoder(utf8Decoder(JSON.stringify({
        expiration: iso8601(expiration),
        conditions,
    })));
    const signingKey = await getSigningKey(sha256, clientCredentials, shortDate, clientRegion, "s3");
    const signature = await hmac(sha256, signingKey, encodedPolicy);
    const endpoint = toEndpointV1(await getEndpointFromInstructions({ Bucket, Key }, PutObjectCommand, {
        ...client.config,
    }, {
        logger: client.config.logger,
    }));
    return {
        url: formatUrl(endpoint),
        fields: {
            ...fields,
            key: Key,
            Policy: encodedPolicy,
            [SIGNATURE_QUERY_PARAM]: toHex(signature),
        },
    };
};
const iso8601 = (date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");
const hmac = (ctor, secret, data) => {
    const hash = new ctor(secret);
    hash.update(toUint8Array(data));
    return hash.digest();
};
