/**
 * Language-independent errors: they carry a code and parameters,
 * and the UI turns them into a message in the current language.
 * Codes must exist in the `errors` section of the dictionaries.
 */
export type ErrorCode =
  | 'pdfEmpty'
  | 'pdfInvalid'
  | 'pdfNoPages'
  | 'pdfEncrypted'
  | 'pdfPassword'
  | 'mergeTooFew'
  | 'resultEmpty'
  | 'pageMissing'
  | 'noRanges'
  | 'groupEmpty'
  | 'unsupportedText'
  | 'watermarkEmpty'
  | 'noImages'
  | 'imageInvalid'
  | 'imageEncode'
  | 'noPlacement'
  | 'signatureMissing'
  | 'nothingToBuild'
  | 'rangeInvalid'
  | 'rangeStartsAt1'
  | 'rangeOutOfBounds'
  | 'rangeReversed'
  | 'rangeRequired'
  | 'everyInvalid'
  | 'fileWrongType'
  | 'fileEmpty'
  | 'fileTooLarge'
  | 'totalTooLarge'
  | 'tooManyFiles'
  | 'singleFileOnly'
  | 'sigDrawFirst'
  | 'sigChooseImage'
  | 'sigEmpty'
  | 'sigNotImage'
  | 'sigTooLarge'
  | 'workerCrash'
  | 'unknown';

export type ErrorParams = Record<string, string | number | undefined>;

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly params: ErrorParams = {},
  ) {
    super(code);
    this.name = 'AppError';
  }
}

/** Rebuilds an AppError from a structured-cloned object (worker messages). */
export function toAppError(value: unknown): AppError {
  if (value instanceof AppError) return value;
  const v = value as { code?: ErrorCode; params?: ErrorParams } | undefined;
  if (v && typeof v.code === 'string') return new AppError(v.code, v.params ?? {});
  return new AppError('unknown');
}
