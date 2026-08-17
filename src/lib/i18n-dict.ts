import { AR_HOME } from "./i18n/dict-home";
import { AR_EXERCISE } from "./i18n/dict-exercise";
import { AR_BODY } from "./i18n/dict-body";
import { AR_FOOD } from "./i18n/dict-food";
import { AR_GOAL } from "./i18n/dict-goal";
import { AR_AUTH } from "./i18n/dict-auth";

/** English source string -> Arabic. Missing keys fall back to the English key. */
export const AR: Record<string, string> = {
  ...AR_HOME,
  ...AR_EXERCISE,
  ...AR_BODY,
  ...AR_FOOD,
  ...AR_GOAL,
  ...AR_AUTH,
};
