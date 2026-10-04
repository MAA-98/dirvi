export type FeedbackType = 'success' | 'message' | 'error';

declare const feedbackBrand: unique symbol;

/**
 * Opaque runtime feedback message.
 *
 * Its representation is private to the feedback module. Consumers must use
 * FeedbackApi operations to create, update, and inspect it.
 */
export type Feedback = Readonly<{
  readonly [feedbackBrand]: typeof feedbackBrand;
}>;

export type FeedbackApi = Readonly<{
  /**
   * Creates feedback for a new message and notifies the configured hook.
   * Defaults to a standard message.
   */
  addMessage: (message: string, type?: FeedbackType) => Feedback;

  /** Returns the message represented by feedback. */
  getMessage: (feedback: Feedback) => string;

  /** Returns the display type represented by feedback. */
  getType: (feedback: Feedback) => FeedbackType;
}>;
