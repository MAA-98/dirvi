/** Stable categories for errors raised while collecting startup initialization. */
export type InitRuntimeErrorCode =
  | 'ALREADY_FINISHED'
  | 'INVALID_VALUE'
  | 'DUPLICATE_APP'
  | 'DUPLICATE_EX_COMMAND'
  | 'INVALID_EX_COMMAND_HANDLER'
  | 'INVALID_CONFIG'
  | 'INVALID_APP_PACKAGE_REFERENCE'
  | 'NO_APPS_REGISTERED'
  | 'INITIAL_APP_NOT_REGISTERED'
  | 'INTERNAL_INVARIANT';

/**
 * Base class for errors raised by the initialization runtime.
 *
 * Consumers can use `code` for reliable error handling without depending on
 * message text. `cause` is set when an underlying validation error is wrapped.
 */
export class InitRuntimeError extends Error {
  constructor(
    readonly code: InitRuntimeErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** An initialization API was used after its runtime had been sealed. */
export class InitializationAlreadyFinishedError extends InitRuntimeError {
  constructor() {
    super(
      'ALREADY_FINISHED',
      'Initialization has finished. Make all registrations while init.mjs is evaluated.',
    );
  }
}

/** A registration API received a value of the wrong type or an empty string. */
export class InvalidInitializationValueError extends InitRuntimeError {
  constructor(label: string, expected: string) {
    super('INVALID_VALUE', `${label} ${expected}.`);
  }
}

/** An app ID was registered more than once. */
export class DuplicateAppRegistrationError extends InitRuntimeError {
  constructor(id: string) {
    super(
      'DUPLICATE_APP',
      `An app with ID "${id}" was registered multiple times.`,
    );
  }
}

/** An Ex command name was registered more than once. */
export class DuplicateExCommandRegistrationError extends InitRuntimeError {
  constructor(name: string) {
    super(
      'DUPLICATE_EX_COMMAND',
      `An Ex command named "${name}" was registered multiple times.`,
    );
  }
}

/** An Ex command registration supplied a value that is not a handler function. */
export class InvalidExCommandHandlerError extends InitRuntimeError {
  constructor() {
    super(
      'INVALID_EX_COMMAND_HANDLER',
      'Ex command handler must be a function.',
    );
  }
}

/** The initialization script supplied options that do not resolve to valid config. */
export class InvalidInitializationConfigError extends InitRuntimeError {
  constructor(cause: unknown) {
    super(
      'INVALID_CONFIG',
      `Initialization produced invalid configuration: ${getErrorMessage(cause)}`,
      { cause },
    );
  }
}

/** An app registration supplied a package reference that failed validation. */
export class InvalidAppPackageReferenceError extends InitRuntimeError {
  constructor(cause: unknown) {
    super(
      'INVALID_APP_PACKAGE_REFERENCE',
      `Invalid app package reference: ${getErrorMessage(cause)}`,
      { cause },
    );
  }
}

/** Initialization completed without registering any apps. */
export class NoAppsRegisteredError extends InitRuntimeError {
  constructor() {
    super(
      'NO_APPS_REGISTERED',
      'Initialization did not register any apps.' +
        'Call dirvi.app.register(app) at least once in init.mjs.' +
        'See /examples/ts-init/ for writing an init.mjs in TypeScript.',
    );
  }
}

/** The explicitly selected startup app was not registered. */
export class InitialAppNotRegisteredError extends InitRuntimeError {
  constructor(id: string) {
    super(
      'INITIAL_APP_NOT_REGISTERED',
      `Startup app "${id}" has not been registered.`,
    );
  }
}

/** An internal invariant required by the initialization runtime was violated. */
export class InitRuntimeInvariantError extends InitRuntimeError {
  constructor(message: string) {
    super('INTERNAL_INVARIANT', message);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
