import type { ComponentType } from 'react';

import type {
  Feedback,
  FeedbackApi,
  InputModeState,
  UserInput,
} from 'dirvi-lib';

import type { Config } from '../domain/config.js';
import { View } from './view.js';

/**
 * State and callbacks required by a React host screen.
 *
 * The screen owns host-specific concerns such as input subscription, viewport
 * measurement, and host exit. App owns Dirvi state transitions and effects.
 */
export type AppScreenProps = {
  readonly view: View;
  readonly feedback: Feedback | undefined;
  readonly feedbackApi: FeedbackApi;
  readonly config: Config;
  readonly inputState: InputModeState;

  readonly handleInput: (userInput: UserInput) => void;
  readonly onRowsChange: (rows: number) => void;

  readonly exitStatus: string | undefined;
};

/**
 * A host-specific React implementation of the Dirvi application screen.
 *
 * InkScreen is the terminal implementation. A future web or React Native host
 * can provide a different component that conforms to this same contract.
 */
export type AppScreenRenderer = ComponentType<AppScreenProps>;
