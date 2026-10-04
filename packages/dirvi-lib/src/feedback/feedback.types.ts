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
   */
  addMessage: (message: string) => Feedback;

  /** Returns the message represented by feedback. */
  getMessage: (feedback: Feedback) => string;
}>;
