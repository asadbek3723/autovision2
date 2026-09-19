export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public retryAfter?: number
  ) {
    super(message);
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new HttpError(400, 'bad_request', message, fields);

export const unauthorized = (message = 'Avtorizatsiya talab qilinadi', code = 'unauthorized') =>
  new HttpError(401, code, message);

export const forbidden = (message = 'Ruxsat yoʻq', code = 'forbidden') =>
  new HttpError(403, code, message);

export const notFound = (message = 'Topilmadi') => new HttpError(404, 'not_found', message);

export const conflict = (message: string, code = 'conflict') =>
  new HttpError(409, code, message);

export const unprocessable = (message: string, fields?: Record<string, string>) =>
  new HttpError(422, 'validation_error', message, fields);

export const tooMany = (message: string, retryAfter?: number) =>
  new HttpError(429, 'rate_limited', message, undefined, retryAfter);
