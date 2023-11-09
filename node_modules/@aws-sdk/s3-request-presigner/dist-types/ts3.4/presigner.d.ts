import { SignatureV4MultiRegionInit } from "@aws-sdk/signature-v4-multi-region";
import { RequestPresigner, RequestPresigningArguments } from "@smithy/types";
import { HttpRequest as IHttpRequest } from "@smithy/types";
type PartialBy<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>> &
  Partial<Pick<T, K>>;
export type S3RequestPresignerOptions = PartialBy<
  SignatureV4MultiRegionInit,
  "service" | "uriEscapePath"
> & {
  signingName?: string;
};
export declare class S3RequestPresigner implements RequestPresigner {
  private readonly signer;
  constructor(options: S3RequestPresignerOptions);
  presign(
    requestToSign: IHttpRequest,
    {
      unsignableHeaders,
      unhoistableHeaders,
      ...options
    }?: RequestPresigningArguments
  ): Promise<IHttpRequest>;
}
export {};
