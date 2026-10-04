import type {
  Feedback,
  FeedbackApi,
  FeedbackType
} from './feedback.types.js';

type FeedbackValue = Readonly<{
  message: string;
  type: FeedbackType;
}>;

const values = new WeakMap<Feedback, FeedbackValue>();

function createFeedback(message: string, type: FeedbackType): Feedback {
  const feedback = Object.freeze({}) as Feedback;

  values.set(feedback, { message, type });

  return feedback;
}

function getValue(feedback: Feedback): FeedbackValue {
  const value = values.get(feedback);

  if (value === undefined) {
    throw new Error('Invalid Feedback value');
  }

  return value;
}

/**
 * Creates the feedback algebra.
 *
 * `onMessageAdded` is an application/UI hook. It is called after a new
 * feedback value has been created, allowing an outer layer to render it.
 */
export function createFeedbackApi(
  onMessageAdded?: (feedback: Feedback, message: string) => void,
): FeedbackApi {
  return {
    addMessage(message, type = 'message') {
      const feedback = createFeedback(message, type);

      onMessageAdded?.(feedback, message);

      return feedback;
    },

    getMessage(feedback) {
      return getValue(feedback).message;
    },

    getType(feedback) {
      return getValue(feedback).type;
    },
  };
}
