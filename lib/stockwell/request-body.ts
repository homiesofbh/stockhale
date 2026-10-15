export class RequestBodyError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "RequestBodyError";
  }
}

/** Read a JSON request with a byte limit enforced before buffering the body. */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength))
      throw new RequestBodyError("Invalid Content-Length.", 400);
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength))
      throw new RequestBodyError("Invalid Content-Length.", 400);
    if (declaredLength > maxBytes)
      throw new RequestBodyError("Request body too large.", 413);
  }

  if (!request.body)
    throw new RequestBodyError("Invalid JSON request body.", 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new RequestBodyError("Request body too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = Buffer.concat(
    chunks.map((chunk) =>
      Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength),
    ),
    totalBytes,
  );
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new RequestBodyError("Request body must be valid UTF-8.", 400);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestBodyError("Invalid JSON request body.", 400);
  }
}
